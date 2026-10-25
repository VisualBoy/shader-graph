import React, { useState, useRef, useEffect } from "react";
import { CircuitStore } from "../nodl-react";
import { WebGLPreview, PreviewGeometryType } from "./WebGLPreview";
import { Experience } from "./Experience";
import { glslBackend } from "../backends/GLSLBackend";
import { tslBackend } from "../backends/TSLBackend";
import { ShaderBackendType } from "../backends/ShaderBackend";
import { EditorEventEmitter } from "../nodes/utils";
import { Node } from "../nodl-core";
import { FloatUniform, Vec2Uniform, Vec3Uniform } from "../nodes/UniformNodes";

interface RightPanelProps {
  store: CircuitStore;
  activeBackend: ShaderBackendType;
  glslError?: string | null;
  onOpenImport: () => void;
  isOpen?: boolean;
  onToggleOpen?: () => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  store,
  activeBackend,
  glslError,
  onOpenImport,
  isOpen: controlledIsOpen,
  onToggleOpen,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth > 960 : true
  );
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const setIsOpen = (open: boolean) => {
    if (onToggleOpen && controlledIsOpen !== undefined) {
      if (open !== controlledIsOpen) onToggleOpen();
    } else {
      setInternalIsOpen(open);
    }
  };

  const [isMobileOrTablet, setIsMobileOrTablet] = useState(
    typeof window !== "undefined" ? window.innerWidth < 960 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobileOrTablet(window.innerWidth < 960);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [activeTab, setActiveTab] = useState<"Properties" | "Uniforms" | "Globals" | "Code">("Globals");
  const [selectedGeometry, setSelectedGeometry] = useState<PreviewGeometryType>("sphere");
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [bulkImportText, setBulkImportText] = useState("");
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isGeomMenuOpen, setIsGeomMenuOpen] = useState(false);
  const [screenshotSuccess, setScreenshotSuccess] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const webglPreviewRef = useRef<WebGLPreview | null>(null);
  const experienceRef = useRef<Experience | null>(null);

  // Listen to node selections
  useEffect(() => {
    const unsub = EditorEventEmitter.on("selectionChanged", ({ nodes }) => {
      if (nodes && nodes.length > 0) {
        setSelectedNode(nodes[0]);
      } else {
        setSelectedNode(null);
      }
    });
    return unsub;
  }, []);

  // Initialize and update preview renderer
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;

    if (activeBackend === "GLSL") {
      if (experienceRef.current) {
        experienceRef.current.dispose();
        experienceRef.current = null;
      }

      try {
        const preview = new WebGLPreview(canvas);
        preview.setGeometry(selectedGeometry);
        webglPreviewRef.current = preview;

        const res = glslBackend.compile(store.nodes);
        preview.updateShaders(res.vertexShader, res.fragmentShader, res.uniforms);
      } catch (e) {
        console.error("Preview init notice:", e);
      }
    } else {
      if (webglPreviewRef.current) {
        webglPreviewRef.current.dispose();
        webglPreviewRef.current = null;
      }

      try {
        experienceRef.current = new Experience(canvas, { width: 300, height: 240 });
      } catch (e) {
        console.error("Experience init notice:", e);
      }
    }

    const updatePreview = () => {
      if (activeBackend === "GLSL" && webglPreviewRef.current) {
        const res = glslBackend.compile(store.nodes);
        webglPreviewRef.current.updateShaders(res.vertexShader, res.fragmentShader, res.uniforms);
      } else if (activeBackend === "TSL" && experienceRef.current) {
        experienceRef.current.render();
      }
    };

    const unsubChanged = EditorEventEmitter.on("changed", updatePreview);
    const unsubForce = EditorEventEmitter.on("forceRender", updatePreview);

    return () => {
      unsubChanged();
      unsubForce();
      if (webglPreviewRef.current) {
        webglPreviewRef.current.dispose();
        webglPreviewRef.current = null;
      }
      if (experienceRef.current) {
        experienceRef.current.dispose();
        experienceRef.current = null;
      }
    };
  }, [activeBackend, isOpen]);

  const handleGeometrySwitch = (geom: PreviewGeometryType) => {
    setSelectedGeometry(geom);
    setIsGeomMenuOpen(false);
    if (webglPreviewRef.current) {
      webglPreviewRef.current.setGeometry(geom);
    }
  };

  const handleTakeSnapshot = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `shader-preview-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setScreenshotSuccess(true);
    setTimeout(() => setScreenshotSuccess(false), 1500);
  };

  const handleBulkImport = () => {
    if (!bulkImportText.trim()) return;
    // Extract declared uniforms from text
    const lines = bulkImportText.split(";").map((l) => l.trim()).filter(Boolean);
    let addedCount = 0;

    lines.forEach((line) => {
      if (line.includes("uniform")) {
        const nameMatch = /([a-zA-Z0-9_]+)\s*=\s*uniform\((.*)\)/.exec(line);
        if (nameMatch) {
          const varName = nameMatch[1];
          const inner = nameMatch[2];
          if (inner.includes("vec2")) {
            const node = new Vec2Uniform();
            node.localName = varName;
            store.setNodes([[node, { x: -400, y: Math.random() * 200 }]]);
            addedCount++;
          } else if (inner.includes("vec3")) {
            const node = new Vec3Uniform();
            node.localName = varName;
            store.setNodes([[node, { x: -400, y: Math.random() * 200 }]]);
            addedCount++;
          } else {
            const node = new FloatUniform();
            node.localName = varName;
            store.setNodes([[node, { x: -400, y: Math.random() * 200 }]]);
            addedCount++;
          }
        }
      }
    });

    setBulkImportText("");
    if (addedCount > 0) {
      EditorEventEmitter.emit("changed");
      EditorEventEmitter.emit("forceRender");
      store.save();
    }
  };

  // Compile result for code tab
  const activeCode = React.useMemo(() => {
    try {
      if (activeBackend === "GLSL") {
        return glslBackend.compile(store.nodes).fragmentShader;
      }
      return tslBackend.compile(store.nodes).tslCode || "";
    } catch (e) {
      return `// Compilation error: ${(e as Error)?.message || String(e)}`;
    }
  }, [store.nodes.length, activeBackend]);

  return (
    <>
      {/* Floating Toggle Button when closed */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: "fixed",
            right: 0,
            top: isMobileOrTablet ? "52px" : "56px",
            zIndex: 1000,
            backgroundColor: "#161925",
            border: "1px solid #282d42",
            borderRight: "none",
            borderTopLeftRadius: "8px",
            borderBottomLeftRadius: "8px",
            color: "#60a5fa",
            padding: "10px 10px",
            minHeight: "44px",
            minWidth: "44px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            boxShadow: "-2px 6px 16px rgba(0, 0, 0, 0.5)",
            touchAction: "manipulation",
          }}
          title="Open 3D Preview & Inspector"
          aria-label="Open 3D Preview & Inspector"
        >
          <span style={{ fontSize: "10px", color: "#94a3b8" }}>◀</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            <path d="M2 12h20" />
          </svg>
          <span style={{ fontSize: "11px", fontWeight: 700 }}>Preview</span>
        </button>
      )}

      {/* Mobile/Tablet Backdrop Overlay */}
      {isOpen && isMobileOrTablet && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(3px)",
            zIndex: 9998,
          }}
        />
      )}

      <aside
        style={{
          position: "fixed",
          top: "44px",
          bottom: 0,
          right: 0,
          width: isMobileOrTablet ? "min(330px, 92vw)" : "320px",
          backgroundColor: "#0d0f17",
          borderLeft: "1px solid #1f2333",
          zIndex: isMobileOrTablet ? 9999 : 1000,
          display: isOpen ? "flex" : "none",
          flexDirection: "column",
          fontFamily: "'Inter', sans-serif",
          userSelect: "none",
          boxShadow: isMobileOrTablet ? "-6px 0 25px rgba(0, 0, 0, 0.6)" : "none",
        }}
      >
        {/* Panel Header Bar with Close Button */}
        <div
          style={{
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #1c2030",
            backgroundColor: "#111420",
            minHeight: "40px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
              <path d="M2 12h20" />
            </svg>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#f8fafc" }}>
              3D Viewport & Inspector
            </span>
          </div>

          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: "15px",
              minWidth: "32px",
              minHeight: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "4px",
              touchAction: "manipulation",
            }}
            title="Collapse Inspector"
            aria-label="Collapse Inspector"
          >
            ✕
          </button>
        </div>

        {/* Top 3D / WebGL Viewport Container */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: isMobileOrTablet ? "210px" : "240px",
            backgroundColor: "#090a0f",
            borderBottom: "1px solid #1f2333",
            overflow: "hidden",
          }}
        >
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            cursor: "grab",
          }}
        />

        {/* Viewport Top-Right Actions */}
        <div
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            zIndex: 10,
          }}
        >
          {/* Geometry Selector Button */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setIsGeomMenuOpen((prev) => !prev)}
              style={{
                backgroundColor: "rgba(22, 25, 37, 0.8)",
                border: "1px solid #282d42",
                borderRadius: "4px",
                color: "#cbd5e1",
                padding: "4px 6px",
                fontSize: "11px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                backdropFilter: "blur(4px)",
              }}
              title="Change Geometry"
            >
              <span>{selectedGeometry.toUpperCase()}</span>
              <span style={{ fontSize: "9px" }}>▾</span>
            </button>

            {isGeomMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "26px",
                  right: 0,
                  backgroundColor: "#161925",
                  border: "1px solid #282d42",
                  borderRadius: "6px",
                  padding: "4px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  zIndex: 100,
                }}
              >
                {(["sphere", "cube", "plane", "quad"] as PreviewGeometryType[]).map((geom) => (
                  <button
                    key={geom}
                    onClick={() => handleGeometrySwitch(geom)}
                    style={{
                      padding: "4px 10px",
                      fontSize: "11px",
                      textAlign: "left",
                      backgroundColor: selectedGeometry === geom ? "#1e62ff" : "transparent",
                      color: selectedGeometry === geom ? "#fff" : "#cbd5e1",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    {geom}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Camera Snapshot Button */}
          <button
            onClick={handleTakeSnapshot}
            style={{
              backgroundColor: "rgba(22, 25, 37, 0.8)",
              border: "1px solid #282d42",
              borderRadius: "4px",
              color: screenshotSuccess ? "#34d399" : "#cbd5e1",
              padding: "4px 6px",
              fontSize: "11px",
              cursor: "pointer",
              backdropFilter: "blur(4px)",
            }}
            title="Snapshot Canvas PNG"
          >
            📷
          </button>
        </div>

        {/* Viewport Status Banner */}
        <div
          style={{
            position: "absolute",
            bottom: "6px",
            left: "8px",
            right: "8px",
            padding: "5px 10px",
            borderRadius: "4px",
            backgroundColor: glslError ? "#e11d48" : "rgba(16, 185, 129, 0.85)",
            color: "#fff",
            fontSize: "11px",
            fontWeight: 500,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            backdropFilter: "blur(4px)",
          }}
        >
          {glslError ? `Error: ${glslError}` : `✓ ${activeBackend} Pipeline Running`}
        </div>
      </div>

      {/* Tab Segment Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          backgroundColor: "#141722",
          borderBottom: "1px solid #1f2333",
          padding: "4px 8px",
          gap: "4px",
        }}
      >
        {(["Properties", "Uniforms", "Globals", "Code"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: "5px 0",
              fontSize: "11px",
              fontWeight: activeTab === tab ? 600 : 400,
              backgroundColor: activeTab === tab ? "#202538" : "transparent",
              color: activeTab === tab ? "#ffffff" : "#94a3b8",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              transition: "all 0.12s ease",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content Area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "14px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          fontSize: "12px",
          color: "#cbd5e1",
        }}
      >
        {/* Globals Tab */}
        {activeTab === "Globals" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#fff" }}>
                Globals
              </span>
              <button
                onClick={() => {
                  const node = new FloatUniform();
                  store.setNodes([[node, { x: -350, y: 0 }]]);
                  EditorEventEmitter.emit("changed");
                  store.save();
                }}
                style={{
                  padding: "3px 8px",
                  fontSize: "11px",
                  fontWeight: 600,
                  backgroundColor: "#1e62ff",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                + Add
              </button>
            </div>

            <div style={{ fontSize: "11px", color: "#64748b", lineHeight: "1.4" }}>
              Define project-level uniforms, varyings, and constants.
            </div>

            {/* Bulk Import Section */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                padding: "10px",
                backgroundColor: "#141722",
                border: "1px solid #232738",
                borderRadius: "6px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.05em" }}>
                  BULK IMPORT
                </span>
                <button
                  onClick={handleBulkImport}
                  style={{
                    padding: "2px 8px",
                    fontSize: "10px",
                    fontWeight: 600,
                    backgroundColor: "#1c2030",
                    border: "1px solid #2c324b",
                    borderRadius: "4px",
                    color: "#cbd5e1",
                    cursor: "pointer",
                  }}
                >
                  Import
                </button>
              </div>

              <textarea
                value={bulkImportText}
                onChange={(e) => setBulkImportText(e.target.value)}
                placeholder="Paste const foo = uniform(1); const bar = uniform(vec2(0, 0));"
                rows={3}
                style={{
                  width: "100%",
                  backgroundColor: "#0d0f17",
                  border: "1px solid #1f2333",
                  borderRadius: "4px",
                  padding: "6px",
                  fontSize: "11px",
                  color: "#cbd5e1",
                  fontFamily: "'JetBrains Mono', monospace",
                  resize: "vertical",
                  outline: "none",
                }}
              />

              <div style={{ fontSize: "10px", color: "#64748b", lineHeight: "1.3" }}>
                Supports uniform(), varying(), and constant initializers with float, int, bool, vec2, vec3, vec4, and color.
              </div>

              <button
                onClick={onOpenImport}
                style={{
                  marginTop: "4px",
                  padding: "6px 10px",
                  fontSize: "11px",
                  fontWeight: 600,
                  backgroundColor: "#222738",
                  border: "1px solid #33394f",
                  borderRadius: "5px",
                  color: "#93c5fd",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#2b3248";
                  e.currentTarget.style.borderColor = "#3b82f6";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#222738";
                  e.currentTarget.style.borderColor = "#33394f";
                }}
              >
                <span>⚡ Import Complete GLSL Shader</span>
              </button>
            </div>

            {/* Active Uniforms List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8" }}>
                Active System Uniforms:
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", backgroundColor: "#141722", borderRadius: "4px", fontSize: "11px" }}>
                  <span style={{ fontFamily: "monospace", color: "#60a5fa" }}>u_time</span>
                  <span style={{ color: "#94a3b8" }}>float (elapsed sec)</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", backgroundColor: "#141722", borderRadius: "4px", fontSize: "11px" }}>
                  <span style={{ fontFamily: "monospace", color: "#60a5fa" }}>u_resolution</span>
                  <span style={{ color: "#94a3b8" }}>vec2 (canvas px)</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", backgroundColor: "#141722", borderRadius: "4px", fontSize: "11px" }}>
                  <span style={{ fontFamily: "monospace", color: "#60a5fa" }}>u_mouse</span>
                  <span style={{ color: "#94a3b8" }}>vec2 (normalized)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Properties Tab */}
        {activeTab === "Properties" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#fff" }}>
              Node Properties
            </span>
            {selectedNode ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ padding: "8px", backgroundColor: "#141722", borderRadius: "6px", border: "1px solid #232738" }}>
                  <div style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase" }}>Type</div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#fff" }}>{selectedNode.name}</div>
                  <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "2px" }}>ID: {selectedNode.id.substring(0, 8)}...</div>
                </div>

                <div style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8" }}>Inputs:</div>
                {Object.entries(selectedNode.inputs).map(([name, input]) => (
                  <div key={name} style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", backgroundColor: "#141722", borderRadius: "4px", fontSize: "11px" }}>
                    <span>{name}</span>
                    <span style={{ color: input.connection ? "#34d399" : "#64748b" }}>
                      {input.connection ? "Connected" : "Default"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: "#64748b", fontSize: "11px", textAlign: "center", padding: "20px 0" }}>
                Click any node on the canvas to inspect and configure its parameters.
              </div>
            )}
          </div>
        )}

        {/* Uniforms Tab */}
        {activeTab === "Uniforms" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#fff" }}>
              Playback & Uniform Controls
            </span>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                <span>Animation Speed:</span>
                <span style={{ fontFamily: "monospace", color: "#60a5fa" }}>{playbackSpeed}x</span>
              </div>
              <input
                type="range"
                min="0"
                max="3"
                step="0.1"
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: "#1e62ff" }}
              />
            </div>
          </div>
        )}

        {/* Code Tab */}
        {activeTab === "Code" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#fff" }}>
                Live {activeBackend} Output
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(activeCode);
                }}
                style={{
                  padding: "3px 8px",
                  fontSize: "10px",
                  backgroundColor: "#1c2030",
                  border: "1px solid #2c324b",
                  borderRadius: "4px",
                  color: "#cbd5e1",
                  cursor: "pointer",
                }}
              >
                Copy
              </button>
            </div>
            <pre
              style={{
                margin: 0,
                padding: "8px",
                backgroundColor: "#090a0f",
                borderRadius: "4px",
                border: "1px solid #1f2333",
                fontSize: "10px",
                color: "#e2e8f0",
                fontFamily: "monospace",
                maxHeight: "350px",
                overflow: "auto",
                whiteSpace: "pre-wrap",
              }}
            >
              {activeCode}
            </pre>
          </div>
        )}
      </div>
    </aside>
  </>
);
};
