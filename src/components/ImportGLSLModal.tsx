import React, { useState } from "react";
import { GLSLParser } from "../parser/GLSLParser";
import { CircuitStore } from "../nodl-react";
import { EditorEventEmitter } from "../nodes/utils";

interface ImportGLSLModalProps {
  store: CircuitStore;
  isOpen: boolean;
  onClose: () => void;
}

export const ImportGLSLModal: React.FC<ImportGLSLModalProps> = ({ store, isOpen, onClose }) => {
  const [selectedPreset, setSelectedPreset] = useState<string>("Color Wave (Normal & Time)");
  const [code, setCode] = useState<string>(
    GLSLParser.PRESETS["Color Wave (Normal & Time)"] || ""
  );
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePresetChange = (presetName: string) => {
    setSelectedPreset(presetName);
    const presetCode = GLSLParser.PRESETS[presetName];
    if (presetCode) {
      setCode(presetCode);
      setError(null);
    }
  };

  const handleBuildGraph = () => {
    try {
      setError(null);
      const parsed = GLSLParser.parse(code);

      if (parsed.errors.length > 0) {
        setError(parsed.errors.join("\n"));
        return;
      }

      if (parsed.nodesWithPositions.length === 0) {
        setError("No valid shader statements or outputs detected in the provided GLSL code.");
        return;
      }

      // Dispose existing nodes in store
      store.nodes.forEach((n) => {
        try {
          n.dispose();
        } catch {
          // ignore
        }
      });

      // Clear store nodes and inject new parsed nodes
      store.nodes = [];
      store.setNodes(parsed.nodesWithPositions);

      // Connect ports
      setTimeout(() => {
        parsed.connections.forEach((conn) => {
          try {
            const outPort = conn.fromNode.outputs[conn.fromPort];
            const inPort = conn.toNode.inputs[conn.toPort];
            if (outPort && inPort) {
              outPort.connect(inPort);
            }
          } catch (e) {
            console.warn("Connection wiring notice:", e);
          }
        });

        // Trigger compilation and save
        EditorEventEmitter.emit("changed");
        EditorEventEmitter.emit("forceRender");
        store.save();
      }, 250);

      onClose();
    } catch (err: any) {
      setError(`Failed to parse GLSL shader: ${err?.message || err}`);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        style={{
          backgroundColor: "#161822",
          border: "1px solid #34384e",
          borderRadius: "10px",
          width: "90%",
          maxWidth: "680px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #242736",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "16px", fontWeight: 600, color: "#fff" }}>
              Import GLSL Shader to Graph
            </span>
            <span
              style={{
                fontSize: "11px",
                padding: "2px 8px",
                backgroundColor: "#1e62ff",
                color: "#fff",
                borderRadius: "4px",
                fontWeight: 500,
              }}
            >
              GLSL ES 3.0
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#9ca3af",
              fontSize: "20px",
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ fontSize: "12px", color: "#9ca3af", fontWeight: 500 }}>
              Load Shader Preset or Paste Custom Code:
            </label>
            <select
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              style={{
                backgroundColor: "#242736",
                color: "#e2e8f0",
                border: "1px solid #34384e",
                borderRadius: "6px",
                padding: "4px 8px",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              {Object.keys(GLSLParser.PRESETS).map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
            </select>
          </div>

          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste your GLSL ES 3.0 shader code here..."
            rows={14}
            style={{
              width: "100%",
              backgroundColor: "#0d0f17",
              color: "#e2e8f0",
              border: "1px solid #2a2f3e",
              borderRadius: "6px",
              padding: "12px",
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
              fontSize: "12px",
              lineHeight: "1.5",
              resize: "vertical",
              outline: "none",
            }}
          />

          {error && (
            <div
              style={{
                padding: "8px 12px",
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                borderRadius: "6px",
                color: "#f87171",
                fontSize: "12px",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ fontSize: "11px", color: "#6b7280" }}>
            The parser translates assignments, uniforms (`u_time`, `u_resolution`), functions (`mix`, `sin`, `dot`, `clamp`), vector constructors, and `fragColor` output into connected canvas nodes.
          </div>
        </div>

        {/* Modal Actions */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid #242736",
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            backgroundColor: "#12141c",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "7px 16px",
              fontSize: "13px",
              borderRadius: "6px",
              backgroundColor: "transparent",
              border: "1px solid #34384e",
              color: "#9ca3af",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleBuildGraph}
            style={{
              padding: "7px 18px",
              fontSize: "13px",
              fontWeight: 500,
              borderRadius: "6px",
              backgroundColor: "#1e62ff",
              border: "none",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Build Node Graph
          </button>
        </div>
      </div>
    </div>
  );
};
