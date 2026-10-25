import React from "react";
import { CircuitStore } from "../nodl-react";
import { EditorEventEmitter } from "../nodes/utils";

interface CanvasToolbarProps {
  store: CircuitStore;
  onToggleCodeInspector: () => void;
  onOpenQuickAdd: () => void;
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  store,
  onToggleCodeInspector,
  onOpenQuickAdd,
}) => {
  const handleFitView = () => {
    store._editorTransformation.scale = 1;
    store._editorTransformation.translation = { x: 0, y: 0 };
    store.saveEditorTransformation();
    EditorEventEmitter.emit("forceRender");
  };

  const handleZoomIn = () => {
    store._editorTransformation.scale = Math.min(2.5, store._editorTransformation.scale * 1.2);
    store.saveEditorTransformation();
    EditorEventEmitter.emit("forceRender");
  };

  const handleZoomOut = () => {
    store._editorTransformation.scale = Math.max(0.3, store._editorTransformation.scale * 0.8);
    store.saveEditorTransformation();
    EditorEventEmitter.emit("forceRender");
  };

  const buttonStyle: React.CSSProperties = {
    background: "transparent",
    border: "none",
    color: "#f1f5f9",
    cursor: "pointer",
    padding: "7px 10px",
    borderRadius: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s ease",
    minHeight: "36px",
    minWidth: "36px",
    touchAction: "manipulation",
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "22px",
        left: "50%",
        transform: "translateX(-50%)",
        backgroundColor: "#161926",
        border: "1px solid #2e354f",
        borderRadius: "30px",
        padding: "4px 8px",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        zIndex: 5000,
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05)",
        userSelect: "none",
      }}
    >
      {/* Search & Add Node */}
      <button
        onClick={onOpenQuickAdd}
        style={buttonStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#242c44";
          e.currentTarget.style.color = "#60a5fa";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color = "#f1f5f9";
        }}
        title="Search & Add Node (Space)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>

      <div style={{ width: "1px", height: "16px", backgroundColor: "#2e354f" }} />

      {/* Select Cursor */}
      <button
        style={buttonStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#242c44";
          e.currentTarget.style.color = "#60a5fa";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color = "#f1f5f9";
        }}
        title="Select Mode"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3l7 18 3-7 7-3L3 3z" />
        </svg>
      </button>

      {/* Pan Hand */}
      <button
        style={buttonStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#242c44";
          e.currentTarget.style.color = "#60a5fa";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color = "#f1f5f9";
        }}
        title="Pan Canvas"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 11V6a2 2 0 0 0-4 0v4M14 10V4a2 2 0 0 0-4 0v7M10 10.5V6a2 2 0 0 0-4 0v8M10 14a4 4 0 0 0 8 0V9a2 2 0 0 0-4 0" />
        </svg>
      </button>

      <div style={{ width: "1px", height: "16px", backgroundColor: "#2e354f" }} />

      {/* Fit to View */}
      <button
        onClick={handleFitView}
        style={buttonStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#242c44";
          e.currentTarget.style.color = "#60a5fa";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color = "#f1f5f9";
        }}
        title="Fit & Center View"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
        </svg>
      </button>

      {/* Zoom In */}
      <button
        onClick={handleZoomIn}
        style={buttonStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#242c44";
          e.currentTarget.style.color = "#60a5fa";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color = "#f1f5f9";
        }}
        title="Zoom In"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      </button>

      {/* Zoom Out */}
      <button
        onClick={handleZoomOut}
        style={buttonStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#242c44";
          e.currentTarget.style.color = "#60a5fa";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color = "#f1f5f9";
        }}
        title="Zoom Out"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      </button>

      <div style={{ width: "1px", height: "16px", backgroundColor: "#2e354f" }} />

      {/* Toggle Code Inspector Drawer */}
      <button
        onClick={onToggleCodeInspector}
        style={{
          ...buttonStyle,
          backgroundColor: "#1e293b",
          color: "#60a5fa",
          padding: "6px 12px",
          gap: "6px",
          fontWeight: 600,
          fontSize: "12px",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#2563eb";
          e.currentTarget.style.color = "#ffffff";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "#1e293b";
          e.currentTarget.style.color = "#60a5fa";
        }}
        title="Toggle Live Code Inspector"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
        <span>Code</span>
      </button>
    </div>
  );
};
