import React, { useState, useRef, useEffect } from "react";
import { CircuitStore } from "../nodl-react";
import { ShaderBackendType } from "../backends/ShaderBackend";
import { EditorEventEmitter, SAVE_STATE_TYPE } from "../nodes/utils";

interface HeaderProps {
  store: CircuitStore;
  activeBackend: ShaderBackendType;
  onBackendChange: (type: ShaderBackendType) => void;
  saveState: SAVE_STATE_TYPE;
  onOpenImport: () => void;
  onToggleSidebar?: () => void;
  onToggleInspector?: () => void;
  isSidebarOpen?: boolean;
  isInspectorOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  store,
  activeBackend,
  onBackendChange,
  saveState,
  onOpenImport,
  onToggleSidebar,
  onToggleInspector,
  isSidebarOpen,
  isInspectorOpen,
}) => {
  const [graphName, setGraphName] = useState("Untitled");
  const [isEditingName, setIsEditingName] = useState(false);
  const [activeTab, setActiveTab] = useState<"Material" | "Post">("Material");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isShareCopied, setIsShareCopied] = useState(false);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = windowWidth < 680;
  const isTablet = windowWidth < 1024;
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      window.addEventListener("mousedown", handleClickOutside);
    }
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  const handleSaveJson = () => {
    try {
      const serializedNodes = store.nodes.map((node) => {
        const pos = store.nodePositions.get(node.id) || { x: 0, y: 0 };
        return { ...node.serialize(), position: { x: pos.x, y: pos.y } };
      });
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(serializedNodes, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `${graphName.toLowerCase().replace(/\s+/g, "-")}-graph.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setIsMenuOpen(false);
    } catch (e) {
      console.error("Save JSON error:", e);
    }
  };

  const handleLoadJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        localStorage.setItem("nodes", content);
        store.loadFromJson();
        EditorEventEmitter.emit("changed");
        EditorEventEmitter.emit("forceRender");
        setIsMenuOpen(false);
      } catch (err) {
        console.error("Load JSON parse error:", err);
      }
    };
    reader.readAsText(file);
  };

  const handleClearGraph = () => {
    if (window.confirm("Are you sure you want to clear the entire graph?")) {
      store.nodes.forEach((n) => {
        try {
          n.dispose();
        } catch {
          // ignore
        }
      });
      store.nodes = [];
      store.nodePositions.clear();
      store.nodeElements.clear();
      localStorage.removeItem("nodes");
      EditorEventEmitter.emit("changed");
      EditorEventEmitter.emit("forceRender");
      setIsMenuOpen(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsShareCopied(true);
    setTimeout(() => setIsShareCopied(false), 1500);
  };

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "44px",
        backgroundColor: "#0d0f17",
        borderBottom: "1px solid #1f2333",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 14px",
        zIndex: 10000,
        fontFamily: "'Inter', sans-serif",
        userSelect: "none",
      }}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleLoadJson}
        accept=".json"
        style={{ display: "none" }}
      />

      {/* Left Segment: Toggle Sidebar + Logo + Title + Tabs + Backend switch */}
      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "6px" : "10px" }}>
        {/* Mobile / Tablet Nodes Sidebar Toggle Button */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "4px 8px",
              backgroundColor: isSidebarOpen ? "#1e62ff" : "#161925",
              color: isSidebarOpen ? "#ffffff" : "#94a3b8",
              border: "1px solid #282d42",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: 600,
              minHeight: "32px",
              touchAction: "manipulation",
            }}
            title={isSidebarOpen ? "Hide Nodes Sidebar" : "Show Nodes Sidebar"}
            aria-label="Toggle Nodes Sidebar"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
            {!isMobile && <span>Nodes</span>}
          </button>
        )}

        {/* TSL GRAPH Wordmark Pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            backgroundColor: "#161925",
            border: "1px solid #282d42",
            borderRadius: "6px",
            padding: "3px 8px",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#fff", letterSpacing: "0.05em" }}>
            TSL
          </span>
          {!isMobile && (
            <span style={{ fontSize: "9px", fontWeight: 600, color: "#60a5fa", letterSpacing: "0.08em" }}>
              GRAPH
            </span>
          )}
        </div>

        {/* Editable Name (truncated or hidden on very small viewports) */}
        {!isMobile && (
          isEditingName ? (
            <input
              type="text"
              value={graphName}
              onChange={(e) => setGraphName(e.target.value)}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(e) => e.key === "Enter" && setIsEditingName(false)}
              autoFocus
              style={{
                backgroundColor: "#161925",
                color: "#fff",
                border: "1px solid #1e62ff",
                borderRadius: "4px",
                padding: "2px 6px",
                fontSize: "12px",
                fontWeight: 500,
                outline: "none",
                width: "90px",
              }}
            />
          ) : (
            <span
              onClick={() => setIsEditingName(true)}
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "#cbd5e1",
                cursor: "pointer",
                padding: "2px 6px",
                borderRadius: "4px",
                maxWidth: "90px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                transition: "background 0.15s ease",
              }}
              title="Click to rename"
            >
              {graphName}
            </span>
          )
        )}

        {/* Graph Mode Tabs: Material / Post (Hidden on tablets/mobiles) */}
        {!isTablet && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "#141722",
              border: "1px solid #232738",
              borderRadius: "6px",
              padding: "2px",
              gap: "2px",
            }}
          >
            {(["Material", "Post"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "2px 8px",
                  fontSize: "11px",
                  fontWeight: activeTab === tab ? 600 : 400,
                  backgroundColor: activeTab === tab ? "#242838" : "transparent",
                  color: activeTab === tab ? "#ffffff" : "#94a3b8",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        {/* Backend Target Switcher */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            backgroundColor: "#141722",
            border: "1px solid #232738",
            borderRadius: "6px",
            padding: "2px",
            gap: "2px",
          }}
        >
          <button
            onClick={() => onBackendChange("GLSL")}
            style={{
              padding: isMobile ? "2px 6px" : "2px 10px",
              fontSize: "11px",
              fontWeight: activeBackend === "GLSL" ? 600 : 400,
              backgroundColor: activeBackend === "GLSL" ? "#1e62ff" : "transparent",
              color: activeBackend === "GLSL" ? "#ffffff" : "#94a3b8",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              transition: "all 0.15s ease",
              touchAction: "manipulation",
            }}
          >
            {isMobile ? "GLSL" : "GLSL ES 3.0"}
          </button>
          <button
            onClick={() => onBackendChange("TSL")}
            style={{
              padding: isMobile ? "2px 6px" : "2px 10px",
              fontSize: "11px",
              fontWeight: activeBackend === "TSL" ? 600 : 400,
              backgroundColor: activeBackend === "TSL" ? "#1e62ff" : "transparent",
              color: activeBackend === "TSL" ? "#ffffff" : "#94a3b8",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              transition: "all 0.15s ease",
              touchAction: "manipulation",
            }}
          >
            {isMobile ? "TSL" : "Three.js TSL"}
          </button>
        </div>
      </div>

      {/* Right Segment: 3D Preview Toggle + Import + Save Badge + Share + Menu */}
      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "4px" : "8px" }}>
        {/* Toggle 3D Preview / Inspector Button */}
        {onToggleInspector && (
          <button
            onClick={onToggleInspector}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: isMobile ? "4px 8px" : "4px 10px",
              backgroundColor: isInspectorOpen ? "#1e62ff" : "#1c2030",
              color: isInspectorOpen ? "#ffffff" : "#e2e8f0",
              border: "1px solid #2c324b",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: 600,
              minHeight: "32px",
              touchAction: "manipulation",
            }}
            title={isInspectorOpen ? "Hide 3D Viewport" : "Show 3D Viewport"}
            aria-label="Toggle 3D Viewport"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
              <path d="M2 12h20" />
            </svg>
            <span>{isMobile ? "3D" : "Preview"}</span>
          </button>
        )}

        {/* Import GLSL button (Desktop only, available in menu/sidebar on mobile) */}
        {!isTablet && (
          <button
            onClick={onOpenImport}
            style={{
              padding: "3px 10px",
              fontSize: "11px",
              fontWeight: 500,
              backgroundColor: "#1c2030",
              border: "1px solid #2c324b",
              borderRadius: "6px",
              color: "#e2e8f0",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              transition: "all 0.15s ease",
            }}
          >
            <span>↓ Import GLSL</span>
          </button>
        )}

        {/* Saved Status Badge Pill */}
        <div
          onClick={() => store.save()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            padding: isMobile ? "3px 6px" : "3px 10px",
            borderRadius: "12px",
            backgroundColor:
              saveState === "SAVED"
                ? "rgba(16, 185, 129, 0.12)"
                : saveState === "SAVING"
                ? "rgba(234, 179, 8, 0.12)"
                : "rgba(239, 68, 68, 0.12)",
            border: `1px solid ${
              saveState === "SAVED"
                ? "rgba(16, 185, 129, 0.35)"
                : saveState === "SAVING"
                ? "rgba(234, 179, 8, 0.35)"
                : "rgba(239, 68, 68, 0.35)"
            }`,
            color:
              saveState === "SAVED"
                ? "#34d399"
                : saveState === "SAVING"
                ? "#fde047"
                : "#f87171",
            fontSize: "11px",
            fontWeight: 500,
            cursor: "pointer",
          }}
          title="Click to save immediately"
        >
          <span
            style={{
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              backgroundColor: "currentColor",
            }}
          />
          {!isMobile && (
            <span>{saveState === "SAVING" ? "Saving..." : saveState === "UNSAVED CHANGES" ? "Unsaved" : "Saved"}</span>
          )}
        </div>

        {/* Share Button (Desktop/Tablet) */}
        {!isMobile && (
          <button
            onClick={handleShare}
            style={{
              background: "none",
              border: "none",
              color: isShareCopied ? "#34d399" : "#94a3b8",
              cursor: "pointer",
              padding: "4px 6px",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "color 0.15s ease",
            }}
            title="Share link"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
          </button>
        )}

        {/* More Options Dropdown Button */}
        <div style={{ position: "relative" }} ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen((prev) => !prev)}
            style={{
              background: isMenuOpen ? "#242838" : "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: "14px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
            title="More Options"
          >
            ···
          </button>

          {/* Dropdown Menu (Matches image_f556781f.png) */}
          {isMenuOpen && (
            <div
              style={{
                position: "absolute",
                top: "32px",
                right: 0,
                width: "200px",
                backgroundColor: "#161925",
                border: "1px solid #282d42",
                borderRadius: "8px",
                boxShadow: "0 16px 36px rgba(0, 0, 0, 0.6)",
                padding: "6px 0",
                zIndex: 100000,
                display: "flex",
                flexDirection: "column",
                fontSize: "12px",
                color: "#cbd5e1",
              }}
            >
              {/* File Section */}
              <div style={{ padding: "4px 12px", fontSize: "10px", color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>
                File
              </div>
              <button
                onClick={handleSaveJson}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "7px 12px",
                  background: "none",
                  border: "none",
                  color: "#cbd5e1",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#202538")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <span>📥</span> Save to JSON
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "7px 12px",
                  background: "none",
                  border: "none",
                  color: "#cbd5e1",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#202538")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <span>📤</span> Load from JSON
              </button>
              <button
                onClick={handleClearGraph}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "7px 12px",
                  background: "none",
                  border: "none",
                  color: "#f87171",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#202538")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <span>🗑️</span> Clear graph
              </button>

              <div style={{ height: "1px", backgroundColor: "#242838", margin: "4px 0" }} />

              {/* Help Section */}
              <div style={{ padding: "4px 12px", fontSize: "10px", color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>
                Help
              </div>
              <button
                onClick={() => {
                  alert("TSL / GLSL Shader Graph Editor\n\n• Drag nodes from the left palette onto canvas\n• Connect ports to create your shader\n• Switch between GLSL ES 3.0 and Three.js TSL\n• Preview 3D mesh live in top-right panel\n• Inspect compiled code in the bottom drawer");
                  setIsMenuOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "7px 12px",
                  background: "none",
                  border: "none",
                  color: "#cbd5e1",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#202538")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <span>📖</span> Documentation
              </button>
              <button
                onClick={() => {
                  alert("User Guide:\n\n1. Use left sidebar to search & drag nodes.\n2. In the right panel, preview the live 3D mesh with Sphere, Cube, Plane, or Fullscreen Quad.\n3. Expand the Code Inspector at bottom to view live GLSL and TSL source.");
                  setIsMenuOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "7px 12px",
                  background: "none",
                  border: "none",
                  color: "#cbd5e1",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#202538")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <span>❓</span> User guide
              </button>
              <button
                onClick={() => {
                  onOpenImport();
                  setIsMenuOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "7px 12px",
                  background: "none",
                  border: "none",
                  color: "#cbd5e1",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#202538")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <span>🎓</span> Interactive templates
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
