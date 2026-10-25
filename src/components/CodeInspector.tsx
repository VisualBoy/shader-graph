import React, { useState, useEffect } from "react";
import hljs from "highlight.js/lib/core";
import glsl from "highlight.js/lib/languages/glsl";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import "highlight.js/styles/atom-one-dark.css";
import { CompilationResult, ShaderBackendType } from "../backends/ShaderBackend";

// Register highlight languages
hljs.registerLanguage("glsl", glsl);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);

interface CodeInspectorProps {
  compilationResult: CompilationResult | null;
  activeBackend: ShaderBackendType;
  glslError?: string | null;
  isOpen?: boolean;
  onToggleOpen?: () => void;
}

export const CodeInspector: React.FC<CodeInspectorProps> = ({
  compilationResult,
  activeBackend,
  glslError,
  isOpen: controlledIsOpen,
  onToggleOpen,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const toggleOpen = () => {
    if (onToggleOpen && controlledIsOpen !== undefined) {
      onToggleOpen();
    } else {
      setInternalIsOpen((prev) => !prev);
    }
  };
  const [activeTab, setActiveTab] = useState<"fragment" | "vertex" | "tsl" | "logs">(
    activeBackend === "GLSL" ? "fragment" : "tsl"
  );
  const [copied, setCopied] = useState(false);

  // Sync tab with active backend when switched
  useEffect(() => {
    if (activeBackend === "TSL" && activeTab !== "tsl" && activeTab !== "logs") {
      setActiveTab("tsl");
    } else if (activeBackend === "GLSL" && activeTab === "tsl") {
      setActiveTab("fragment");
    }
  }, [activeBackend]);

  const fragmentCode = compilationResult?.fragmentShader || "// No GLSL code generated yet";
  const vertexCode = compilationResult?.vertexShader || "// No vertex shader generated yet";
  const tslCode = compilationResult?.tslCode || "// No TSL code generated yet";

  const getActiveCode = () => {
    switch (activeTab) {
      case "fragment":
        return fragmentCode;
      case "vertex":
        return vertexCode;
      case "tsl":
        return tslCode;
      default:
        return "";
    }
  };

  const getLanguage = () => {
    return activeTab === "tsl" ? "typescript" : "glsl";
  };

  const highlightedCode = React.useMemo(() => {
    const code = getActiveCode();
    try {
      return hljs.highlight(code, { language: getLanguage() }).value;
    } catch {
      return code;
    }
  }, [activeTab, compilationResult]);

  const handleCopy = () => {
    const code = getActiveCode();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const hasErrors = Boolean(glslError || (compilationResult && compilationResult.errors.length > 0));

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9000,
        fontFamily: "'Inter', sans-serif",
        pointerEvents: "auto",
        transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* Drawer Header / Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 16px",
          backgroundColor: "#161822",
          borderTop: "1px solid #2d3142",
          borderBottom: isOpen ? "1px solid #242736" : "none",
          boxShadow: "0 -4px 12px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={toggleOpen}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 12px",
              backgroundColor: isOpen ? "#1e62ff" : "#242736",
              color: "#fff",
              border: "1px solid #34384e",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 500,
              minHeight: "36px",
              transition: "background 0.15s ease",
              touchAction: "manipulation",
            }}
          >
            <span>{isOpen ? "▼ Hide Code" : "▲ Code Inspector"}</span>
            <span
              style={{
                fontSize: "10px",
                padding: "1px 6px",
                backgroundColor: "rgba(0,0,0,0.3)",
                borderRadius: "4px",
                color: "#9ca3af",
              }}
            >
              {activeBackend}
            </span>
          </button>

          {/* Compilation Status Indicator */}
          {hasErrors ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "3px 8px",
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                borderRadius: "4px",
                color: "#f87171",
                fontSize: "11px",
              }}
            >
              <span>✕ Compilation Error</span>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "3px 8px",
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                border: "1px solid rgba(16, 185, 129, 0.4)",
                borderRadius: "4px",
                color: "#34d399",
                fontSize: "11px",
              }}
            >
              <span>✓ Live Shader OK</span>
            </div>
          )}
        </div>

        {/* Tab Controls (when open) */}
        {isOpen && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <button
              onClick={() => setActiveTab("fragment")}
              style={{
                padding: "4px 10px",
                fontSize: "12px",
                borderRadius: "4px",
                border: "none",
                backgroundColor: activeTab === "fragment" ? "#242736" : "transparent",
                color: activeTab === "fragment" ? "#60a5fa" : "#9ca3af",
                cursor: "pointer",
                fontWeight: activeTab === "fragment" ? 600 : 400,
              }}
            >
              Fragment GLSL
            </button>
            <button
              onClick={() => setActiveTab("vertex")}
              style={{
                padding: "4px 10px",
                fontSize: "12px",
                borderRadius: "4px",
                border: "none",
                backgroundColor: activeTab === "vertex" ? "#242736" : "transparent",
                color: activeTab === "vertex" ? "#60a5fa" : "#9ca3af",
                cursor: "pointer",
                fontWeight: activeTab === "vertex" ? 600 : 400,
              }}
            >
              Vertex GLSL
            </button>
            <button
              onClick={() => setActiveTab("tsl")}
              style={{
                padding: "4px 10px",
                fontSize: "12px",
                borderRadius: "4px",
                border: "none",
                backgroundColor: activeTab === "tsl" ? "#242736" : "transparent",
                color: activeTab === "tsl" ? "#60a5fa" : "#9ca3af",
                cursor: "pointer",
                fontWeight: activeTab === "tsl" ? 600 : 400,
              }}
            >
              TSL Output
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              style={{
                padding: "4px 10px",
                fontSize: "12px",
                borderRadius: "4px",
                border: "none",
                backgroundColor: activeTab === "logs" ? "#242736" : "transparent",
                color: activeTab === "logs" ? (hasErrors ? "#f87171" : "#60a5fa") : "#9ca3af",
                cursor: "pointer",
                fontWeight: activeTab === "logs" ? 600 : 400,
              }}
            >
              Logs {hasErrors ? "(!)" : ""}
            </button>
          </div>
        )}

        {/* Action Button & Close Button */}
        {isOpen && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {activeTab !== "logs" && (
              <button
                onClick={handleCopy}
                style={{
                  padding: "4px 12px",
                  fontSize: "12px",
                  backgroundColor: copied ? "#059669" : "#242736",
                  color: "#fff",
                  border: "1px solid #34384e",
                  borderRadius: "4px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  minHeight: "32px",
                  touchAction: "manipulation",
                }}
              >
                {copied ? "Copied!" : "Copy Code"}
              </button>
            )}
            <button
              onClick={toggleOpen}
              style={{
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                padding: "4px 8px",
                fontSize: "14px",
                lineHeight: 1,
                minHeight: "32px",
                minWidth: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                touchAction: "manipulation",
              }}
              title="Close Drawer"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Drawer Content */}
      {isOpen && (
        <div
          style={{
            height: "min(35vh, 260px)",
            backgroundColor: "#0d0f17",
            overflow: "auto",
            padding: "12px 16px",
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
            fontSize: "12px",
            lineHeight: "1.6",
            color: "#e2e8f0",
          }}
        >
          {activeTab === "logs" ? (
            <div>
              <div style={{ color: "#9ca3af", marginBottom: "8px" }}>WebGL2 Shader Compiler Diagnostics:</div>
              {glslError ? (
                <div
                  style={{
                    padding: "10px 14px",
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "6px",
                    color: "#f87171",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {glslError}
                </div>
              ) : (
                <div style={{ color: "#34d399" }}>
                  No compilation errors reported. Program linked and running cleanly on WebGL 2.0.
                </div>
              )}
            </div>
          ) : (
            <pre style={{ margin: 0 }}>
              <code
                dangerouslySetInnerHTML={{ __html: highlightedCode }}
                style={{ fontFamily: "inherit" }}
              />
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
