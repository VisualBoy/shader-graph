import { useContext, useEffect, useRef, useState } from "react";
import { MeshStandardMaterialNode } from "../../nodes/MaterialNodes";
import { Experience } from "../Experience";
import { WebGLPreview, PreviewGeometryType } from "../WebGLPreview";
import { StoreContext } from "../../nodl-react";
import { createVarNameForNode, EditorEventEmitter } from "../../nodes/utils";
import { Fn } from "three/tsl";
import { Pane } from "tweakpane";
import { Input, Node } from "../../nodl-core";
import { shaderBackendManager, ShaderBackendType } from "../../backends/ShaderBackend";
import { glslBackend } from "../../backends/GLSLBackend";
import { tslBackend } from "../../backends/TSLBackend";

type TreeNodeType = {
  node: Node;
  parents: TreeNodeType[];
};
type TreeType = {
  [key: string]: TreeNodeType;
};

export const MeshStandardMaterialWindow = ({
  node,
}: {
  node: MeshStandardMaterialNode;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { store } = useContext(StoreContext);

  const experienceRef = useRef<Experience | null>(null);
  const webglPreviewRef = useRef<WebGLPreview | null>(null);

  const [activeBackend, setActiveBackend] = useState<ShaderBackendType>(
    shaderBackendManager.activeBackendType
  );
  const [selectedGeometry, setSelectedGeometry] = useState<PreviewGeometryType>("sphere");
  const [glslError, setGlslError] = useState<string | null>(null);

  // Sync with global backend state
  useEffect(() => {
    const unsub = EditorEventEmitter.on("backendChanged", ({ backend }) => {
      setActiveBackend(backend);
    });
    return unsub;
  }, []);

  // Initialize and switch between WebGL2 preview and Three.js TSL experience
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const boundBox = canvas.getBoundingClientRect();

    if (activeBackend === "GLSL") {
      // Clean up Three.js experience if running
      if (experienceRef.current) {
        experienceRef.current.dispose();
        experienceRef.current = null;
      }

      try {
        const preview = new WebGLPreview(canvas);
        preview.setGeometry(selectedGeometry);
        preview.onCompileStatus = (status) => {
          setGlslError(status.error || null);
        };
        webglPreviewRef.current = preview;

        // Perform initial compilation
        const res = glslBackend.compile(store.nodes);
        shaderBackendManager.setLastResult(res);
        preview.updateShaders(res.vertexShader, res.fragmentShader, res.uniforms);
      } catch (err: any) {
        console.error("WebGL2 preview initialization notice:", err);
      }
    } else {
      // Clean up WebGL2 preview if running
      if (webglPreviewRef.current) {
        webglPreviewRef.current.dispose();
        webglPreviewRef.current = null;
      }

      try {
        experienceRef.current = new Experience(
          canvas,
          {
            width: boundBox.width * (1 / store._editorTransformation.scale),
            height: boundBox.height * (1 / store._editorTransformation.scale),
          },
          uiContainer.current || undefined
        );
      } catch (err: any) {
        console.error("TSL Experience initialization notice:", err);
      }
    }

    const compileGraph = () => {
      if (activeBackend === "GLSL" && webglPreviewRef.current) {
        const res = glslBackend.compile(store.nodes);
        shaderBackendManager.setLastResult(res);
        webglPreviewRef.current.updateShaders(res.vertexShader, res.fragmentShader, res.uniforms);
      } else if (activeBackend === "TSL") {
        const res = tslBackend.compile(store.nodes);
        shaderBackendManager.setLastResult(res);
        experienceRef.current?.render();
      }
    };

    const subs = EditorEventEmitter.on("selectionChanged", ({ nodes }) => {
      if (nodes?.includes(node)) {
        experienceRef.current?.startRendering();
      } else {
        experienceRef.current?.stopRendering();
      }
    });

    const forceRenderSubs = EditorEventEmitter.on("forceRender", () => {
      compileGraph();
    });

    const changedSubs = EditorEventEmitter.on("changed", () => {
      compileGraph();
    });

    return () => {
      subs();
      forceRenderSubs();
      changedSubs();
      if (experienceRef.current) {
        experienceRef.current.dispose();
        experienceRef.current = null;
      }
      if (webglPreviewRef.current) {
        webglPreviewRef.current.dispose();
        webglPreviewRef.current = null;
      }
    };
  }, [activeBackend]);

  // Handle geometry changes
  const handleGeometryChange = (geom: PreviewGeometryType) => {
    setSelectedGeometry(geom);
    if (webglPreviewRef.current) {
      webglPreviewRef.current.setGeometry(geom);
    }
  };

  // Node inputs subscription for TSL mode
  useEffect(() => {
    const colorNodeSubs = node.inputs.colorNode?.subscribe((value) => {
      if (activeBackend === "TSL") {
        const colorNode = Fn(value);
        experienceRef.current?.updateNode("colorNode", colorNode);
      } else if (webglPreviewRef.current) {
        const res = glslBackend.compile(store.nodes);
        shaderBackendManager.setLastResult(res);
        webglPreviewRef.current.updateShaders(res.vertexShader, res.fragmentShader, res.uniforms);
      }
    });

    const positionNodeSubs = node.inputs.positionNode?.subscribe((value) => {
      if (activeBackend === "TSL") {
        const positionNode = Fn(value);
        experienceRef.current?.updateNode("positionNode", positionNode);
      }
    });

    const normalNodeSubs = node.inputs.normalNode?.subscribe((value) => {
      if (activeBackend === "TSL") {
        const positionNode = Fn(value);
        experienceRef.current?.updateNode("normalNode", positionNode);
      }
    });

    return () => {
      colorNodeSubs?.unsubscribe();
      positionNodeSubs?.unsubscribe();
      normalNodeSubs?.unsubscribe();
    };
  }, [activeBackend]);

  const btnContainer = useRef<HTMLDivElement>(null);
  const uiContainer = useRef<HTMLDivElement>(null);

  // Copy code button inside node
  useEffect(() => {
    if (!btnContainer.current) return;
    const pane = new Pane({ container: btnContainer.current, expanded: true });
    const btn = pane.addButton({
      title: activeBackend === "GLSL" ? `Copy GLSL ES 3.0` : `Copy TSL Code`,
    });

    let timeoutId: number;

    btn.on("click", () => {
      timeoutId && clearTimeout(timeoutId);
      btn.title = "Copying...";

      if (activeBackend === "GLSL") {
        const res = glslBackend.compile(store.nodes);
        navigator.clipboard.writeText(res.fragmentShader);
        btn.title = "Copied GLSL!";
      } else {
        const res = tslBackend.compile(store.nodes);
        navigator.clipboard.writeText(res.tslCode || "");
        btn.title = "Copied TSL!";
      }

      timeoutId = setTimeout(() => {
        btn.title = activeBackend === "GLSL" ? `Copy GLSL ES 3.0` : `Copy TSL Code`;
      }, 1000);
    });

    return () => {
      timeoutId && clearTimeout(timeoutId);
      pane.dispose();
    };
  }, [activeBackend]);

  return (
    <div style={{ position: "relative", minWidth: "280px" }}>
      {/* Geometry Selector Toolbar for WebGL Preview */}
      {activeBackend === "GLSL" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 8px",
            backgroundColor: "#161822",
            borderBottom: "1px solid #2a2f3e",
            gap: "4px",
          }}
        >
          <span style={{ fontSize: "11px", color: "#9ca3af", fontWeight: 500 }}>
            Geometry:
          </span>
          <div style={{ display: "flex", gap: "3px" }}>
            {(["sphere", "cube", "plane", "quad"] as PreviewGeometryType[]).map((geom) => (
              <button
                key={geom}
                onClick={() => handleGeometryChange(geom)}
                style={{
                  padding: "3px 8px",
                  fontSize: "11px",
                  fontWeight: selectedGeometry === geom ? 600 : 400,
                  backgroundColor: selectedGeometry === geom ? "#1e62ff" : "#242736",
                  color: selectedGeometry === geom ? "#fff" : "#9ca3af",
                  border: "1px solid",
                  borderColor: selectedGeometry === geom ? "#1e62ff" : "#34384e",
                  borderRadius: "4px",
                  cursor: "pointer",
                  textTransform: "capitalize",
                  transition: "all 0.15s ease",
                }}
              >
                {geom}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Compiler Error Overlay */}
      {glslError && activeBackend === "GLSL" && (
        <div
          style={{
            position: "absolute",
            top: "40px",
            left: "8px",
            right: "8px",
            zIndex: 10,
            padding: "8px 10px",
            backgroundColor: "rgba(239, 68, 68, 0.9)",
            color: "#fff",
            borderRadius: "4px",
            fontSize: "11px",
            lineHeight: "1.4",
            pointerEvents: "none",
            maxHeight: "100px",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {glslError}
        </div>
      )}

      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "300px",
          backgroundColor: "#12141c",
          display: "block",
          cursor: "grab",
        }}
      />
      <div ref={uiContainer} />
      <div ref={btnContainer} />
    </div>
  );
};