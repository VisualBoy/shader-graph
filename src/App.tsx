import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import "./App.css";
import { Circuit, CircuitStore } from "./nodl-react";
import { toCartesianPoint } from "./nodl-react/utils/coordinates/coordinates";
import { EditorEventEmitter, SAVE_STATE_TYPE } from "./nodes/utils";
import { createCustomNode } from "./nodes/CustomNode";
import { useNodeWindowResolver } from "./components/NodeWindows";
import { nodesPool } from "./nodes";
import {
  shaderBackendManager,
  ShaderBackendType,
  CompilationResult,
} from "./backends/ShaderBackend";
import { glslBackend } from "./backends/GLSLBackend";
import { tslBackend } from "./backends/TSLBackend";
import { Header } from "./components/Header";
import { NodesSidebar } from "./components/NodesSidebar";
import { RightPanel } from "./components/RightPanel";
import { CanvasToolbar } from "./components/CanvasToolbar";
import { QuickAddMenu } from "./components/QuickAddMenu";
import { CodeInspector } from "./components/CodeInspector";
import { ImportGLSLModal } from "./components/ImportGLSLModal";
import { MeshStandardMaterialNode } from "./nodes/MaterialNodes";
import { UV } from "./nodes/AttributeNodes";
import { TimeUniform } from "./nodes/UniformNodes";
import { Mix, Sin } from "./nodes/MathNodes";
import { Color } from "./nodes/ConstantNodes";

const store = new CircuitStore();

function App() {
  const nodeWindowResolver = useNodeWindowResolver();

  const [saveState, setSaveState] = useState<SAVE_STATE_TYPE>("SAVED");
  const [activeBackend, setActiveBackend] = useState<ShaderBackendType>(
    shaderBackendManager.activeBackendType
  );
  const [compilationResult, setCompilationResult] = useState<CompilationResult | null>(null);
  const [glslError, setGlslError] = useState<string | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddPosition, setQuickAddPosition] = useState<{ x: number; y: number } | undefined>();
  const [isCodeDrawerOpen, setIsCodeDrawerOpen] = useState(false);
  const [customNodeForm, setCustomNodeForm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 768 : true
  );
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth > 960 : true
  );

  const handleAddNodeToCanvas = (nodeName: string, poolName: string) => {
    const pool = nodesPool[poolName as keyof typeof nodesPool];
    if (!pool) return;
    const NodeClass = (pool as any)[nodeName];
    if (!NodeClass) return;

    const nodeInstance = new NodeClass();
    const bounds = circuitContainer.current?.getBoundingClientRect() || {
      width: window.innerWidth,
      height: window.innerHeight,
      left: 0,
      top: 0,
    };

    const clientX = bounds.left + bounds.width / 2;
    const clientY = bounds.top + bounds.height / 2;
    const x =
      (clientX - bounds.left) / store._editorTransformation.scale -
      store._editorTransformation.translation.x;
    const y =
      (clientY - bounds.top) / store._editorTransformation.scale -
      store._editorTransformation.translation.y;

    const pos = toCartesianPoint(
      bounds.width / store._editorTransformation.scale,
      bounds.height / store._editorTransformation.scale,
      x + (Math.random() * 40 - 20),
      y + (Math.random() * 40 - 20)
    );

    store.setNodes([[nodeInstance, pos]]);
    EditorEventEmitter.emit("changed");
    EditorEventEmitter.emit("forceRender");
    store.save();
    setTimeout(() => {
      triggerCompile();
    }, 100);
  };

  // Compile helper
  const triggerCompile = (backendType: ShaderBackendType = activeBackend) => {
    if (backendType === "GLSL") {
      const res = glslBackend.compile(store.nodes);
      setCompilationResult(res);
      shaderBackendManager.setLastResult(res);
    } else {
      const res = tslBackend.compile(store.nodes);
      setCompilationResult(res);
      shaderBackendManager.setLastResult(res);
    }
  };

  useLayoutEffect(() => {
    EditorEventEmitter.on("changed", () => {
      store.save();
      triggerCompile();
    });
    EditorEventEmitter.on("saveStateChanged", (data) => {
      setSaveState(data.state);
    });
    EditorEventEmitter.on("backendChanged", ({ backend }) => {
      setActiveBackend(backend);
      triggerCompile(backend);
    });
    EditorEventEmitter.on("openGLSLImport", () => {
      setIsImportModalOpen(true);
    });

    try {
      store.loadFromJson();
    } catch (e) {
      console.warn("Error calling loadFromJson, resetting storage:", e);
      try {
        localStorage.removeItem("nodes");
      } catch {
        // ignore
      }
    }

    // If canvas is empty on first load, seed with a starter graph
    setTimeout(() => {
      if (store.nodes.length === 0) {
        const mat = new MeshStandardMaterialNode();
        const uv = new UV();
        const time = new TimeUniform();
        const sinNode = new Sin();
        const mixNode = new Mix();
        const colA = new Color();
        colA.setValue("#1e62ff");
        const colB = new Color();
        colB.setValue("#f43f5e");

        store.setNodes([
          [uv, { x: -450, y: -160 }],
          [time, { x: -450, y: 160 }],
          [sinNode, { x: -220, y: 160 }],
          [colA, { x: -220, y: -240 }],
          [colB, { x: -220, y: -60 }],
          [mixNode, { x: 30, y: -60 }],
          [mat, { x: 360, y: 0 }],
        ]);

        setTimeout(() => {
          try {
            time.outputs.value.connect(sinNode.inputs.a);
            colA.outputs.value.connect(mixNode.inputs.x);
            colB.outputs.value.connect(mixNode.inputs.y);
            sinNode.outputs.output.connect(mixNode.inputs.a);
            mixNode.outputs.output.connect(mat.inputs.colorNode);
          } catch (e) {
            console.warn("Notice seeding starter connections:", e);
          }
          triggerCompile();
          store.save();
        }, 300);
      } else {
        triggerCompile();
      }
    }, 1200);

    return () => {
      EditorEventEmitter.removeAllListeners("changed");
      EditorEventEmitter.removeAllListeners("saveStateChanged");
      EditorEventEmitter.removeAllListeners("backendChanged");
      EditorEventEmitter.removeAllListeners("openGLSLImport");
      store.dispose();
    };
  }, []);

  // Shortcut: Space bar opens Quick-Add menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setQuickAddPosition({ x: window.innerWidth / 2 - 125, y: window.innerHeight / 2 - 180 });
        setIsQuickAddOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const circuitContainer = useRef<HTMLDivElement>(null);
  const [containerBound, setContainerBound] = useState<DOMRect>();

  useEffect(() => {
    if (!circuitContainer.current) return;
    const container = circuitContainer.current;
    const rect = container.getBoundingClientRect();
    setContainerBound(rect);
  }, []);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const nodeCodeInputRef = useRef<HTMLTextAreaElement>(null);

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!containerBound) return;

    const [name, poolName] = e.dataTransfer.getData("text/plain").split("-");

    const boundingRect = containerBound;

    const x =
      (e.clientX - boundingRect.left) / store._editorTransformation.scale -
      store._editorTransformation.translation.x;
    const y =
      (e.clientY - boundingRect.top) / store._editorTransformation.scale -
      store._editorTransformation.translation.y;

    const pool = nodesPool[poolName as keyof typeof nodesPool];
    if (!pool) {
      console.warn(`Pool with ${poolName} name does not exist in nodesPool`);
      return;
    }
    const node = (pool as any)[name];
    if (!node) {
      console.warn(`Node with ${name} name does not exist in ${poolName}`);
      return;
    }
    const nodeInstance = new node();

    store.setNodes([
      [
        nodeInstance,
        toCartesianPoint(
          boundingRect.width / store._editorTransformation.scale,
          boundingRect.height / store._editorTransformation.scale,
          x,
          y
        ),
      ],
    ]);

    setTimeout(() => {
      triggerCompile();
    }, 100);
  };

  const onDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const onCustomNodeCreateClick = () => {
    const name = nameInputRef.current?.value;
    const code = nodeCodeInputRef.current?.value;

    if (!name || !code) return;
    try {
      const Node = createCustomNode(code, name);
      store.setNodes([[new Node(), { x: 0, y: 0 }]]);
      setCustomNodeForm(false);
      triggerCompile();
    } catch (e) {
      console.error(e);
    }
  };

  const handleBackendChange = (type: ShaderBackendType) => {
    shaderBackendManager.setBackend(type);
  };

  return (
    <>
      {/* Top Header Bar */}
      <Header
        store={store}
        activeBackend={activeBackend}
        onBackendChange={handleBackendChange}
        saveState={saveState}
        onOpenImport={() => setIsImportModalOpen(true)}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        onToggleInspector={() => setIsRightPanelOpen((prev) => !prev)}
        isSidebarOpen={isSidebarOpen}
        isInspectorOpen={isRightPanelOpen}
      />

      {/* Main Graph Viewport */}
      <div className="main-container">
        {/* Left Nodes Palette Sidebar */}
        <NodesSidebar
          onOpenCustomNodeForm={() => setCustomNodeForm(true)}
          onOpenImportGLSL={() => setIsImportModalOpen(true)}
          onAddNode={handleAddNodeToCanvas}
          isOpen={isSidebarOpen}
          onToggleOpen={() => setIsSidebarOpen((prev) => !prev)}
        />

        {/* Central Nodl Circuit Canvas */}
        <div
          ref={circuitContainer}
          className="circuit-container"
          onDrop={onDrop}
          onDragOver={onDrag}
        >
          <Circuit
            className="circuit"
            store={store}
            nodeWindowResolver={nodeWindowResolver}
          />
        </div>

        {/* Right Inspector & 3D Preview Panel */}
        <RightPanel
          store={store}
          activeBackend={activeBackend}
          glslError={glslError}
          onOpenImport={() => setIsImportModalOpen(true)}
          isOpen={isRightPanelOpen}
          onToggleOpen={() => setIsRightPanelOpen((prev) => !prev)}
        />

        {/* Floating Bottom Canvas Toolbar */}
        <CanvasToolbar
          store={store}
          onToggleCodeInspector={() => setIsCodeDrawerOpen((prev) => !prev)}
          onOpenQuickAdd={() => {
            setQuickAddPosition({ x: window.innerWidth / 2 - 125, y: window.innerHeight / 2 - 180 });
            setIsQuickAddOpen(true);
          }}
        />

        {/* Quick Add Node Menu */}
        <QuickAddMenu
          store={store}
          isOpen={isQuickAddOpen}
          onClose={() => setIsQuickAddOpen(false)}
          position={quickAddPosition}
        />

        {/* Bottom Expandable Code Inspector Drawer */}
        <CodeInspector
          compilationResult={compilationResult}
          activeBackend={activeBackend}
          glslError={glslError}
          isOpen={isCodeDrawerOpen}
          onToggleOpen={() => setIsCodeDrawerOpen((prev) => !prev)}
        />
      </div>

      {/* Import GLSL Modal */}
      <ImportGLSLModal
        store={store}
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />

      {/* Custom Node Form Modal */}
      {customNodeForm && (
        <div className="popup-overlay">
          <div className="popup-container">
            <div className="popup-header">
              <h2 className="popup-title">Add Custom Node</h2>
              <button onClick={() => setCustomNodeForm(false)} className="close-button">✕</button>
            </div>
            <div className="form-group">
              <label htmlFor="nodeName" className="form-label">
                Node Name:
              </label>
              <input id="nodeName" type="text" ref={nameInputRef} className="form-input" />
            </div>
            <div className="form-group">
              <label htmlFor="tslCode" className="form-label">
                Code:
              </label>
              <textarea id="tslCode" ref={nodeCodeInputRef} className="form-textarea" />
            </div>
            <div className="form-actions">
              <button
                type="button"
                onClick={() => setCustomNodeForm(false)}
                className="button button-secondary"
              >
                Cancel
              </button>
              <button onClick={onCustomNodeCreateClick} className="button button-primary">
                Add Node
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an uncaught exception:", error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.removeItem("nodes");
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100vw",
            height: "100vh",
            backgroundColor: "#0b0d14",
            color: "#f8fafc",
            padding: "24px",
            fontFamily: "Inter, sans-serif",
            textAlign: "center",
          }}
        >
          <div
            style={{
              maxWidth: "520px",
              padding: "28px",
              backgroundColor: "#141722",
              border: "1px solid #232738",
              borderRadius: "12px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>⚠️</div>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px 0" }}>
              Something went wrong in the Shader Graph
            </h2>
            <p style={{ fontSize: "13px", color: "#94a3b8", lineHeight: 1.5, margin: "0 0 16px 0" }}>
              The workspace encountered an unexpected error while loading graph nodes or shaders.
            </p>
            {this.state.error?.message && (
              <pre
                style={{
                  backgroundColor: "#0d0f17",
                  padding: "10px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  color: "#f87171",
                  textAlign: "left",
                  maxHeight: "120px",
                  overflowY: "auto",
                  margin: "0 0 20px 0",
                  fontFamily: "monospace",
                }}
              >
                {this.state.error.message}
              </pre>
            )}
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                style={{
                  padding: "8px 16px",
                  fontSize: "12px",
                  fontWeight: 600,
                  backgroundColor: "#202538",
                  border: "1px solid #323952",
                  borderRadius: "6px",
                  color: "#cbd5e1",
                  cursor: "pointer",
                }}
              >
                Try Again
              </button>
              <button
                onClick={this.handleReset}
                style={{
                  padding: "8px 16px",
                  fontSize: "12px",
                  fontWeight: 600,
                  backgroundColor: "#1e62ff",
                  border: "none",
                  borderRadius: "6px",
                  color: "#ffffff",
                  cursor: "pointer",
                }}
              >
                Reset Graph &amp; Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
