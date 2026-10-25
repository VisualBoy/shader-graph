import React, { useState, useMemo, useEffect } from "react";
import { nodesPool } from "../nodes";

interface NodesSidebarProps {
  onOpenCustomNodeForm: () => void;
  onOpenImportGLSL: () => void;
  onAddNode?: (nodeName: string, poolName: string) => void;
  isOpen?: boolean;
  onToggleOpen?: () => void;
}

const CATEGORY_ORDER = [
  "ConstantNodes",
  "MathNodes",
  "AttributeNodes",
  "UniformNodes",
  "MaterialNodes",
  "LogicNodes",
  "VaryingNode",
  "PositionNodes",
  "UtilityNodes",
];

const CATEGORY_LABELS: Record<string, string> = {
  ConstantNodes: "Constants",
  MathNodes: "Math Operations",
  AttributeNodes: "Attributes",
  UniformNodes: "Uniforms",
  MaterialNodes: "Material Outputs",
  LogicNodes: "Logic & Branching",
  VaryingNode: "Varyings",
  PositionNodes: "Position & View",
  UtilityNodes: "Utilities",
};

export const NodesSidebar: React.FC<NodesSidebarProps> = ({
  onOpenCustomNodeForm,
  onOpenImportGLSL,
  onAddNode,
  isOpen: controlledIsOpen,
  onToggleOpen,
}) => {
  // Support both controlled and uncontrolled isOpen
  const [internalIsOpen, setInternalIsOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 768 : true
  );
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const setIsOpen = (open: boolean) => {
    if (onToggleOpen && controlledIsOpen !== undefined) {
      if (open !== controlledIsOpen) onToggleOpen();
    } else {
      setInternalIsOpen(open);
    }
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Main node groups unfolded by default as requested
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    ConstantNodes: true,
    MathNodes: true,
    AttributeNodes: true,
    UniformNodes: true,
    MaterialNodes: true,
    LogicNodes: true,
    VaryingNode: true,
    PositionNodes: true,
    UtilityNodes: false,
  });

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    CATEGORY_ORDER.forEach((cat) => {
      next[cat] = true;
    });
    setExpandedCategories(next);
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    CATEGORY_ORDER.forEach((cat) => {
      next[cat] = false;
    });
    setExpandedCategories(next);
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, nodeName: string, poolName: string) => {
    e.dataTransfer.setData("text/plain", `${nodeName}-${poolName}`);
  };

  const handleNodeClick = (nodeName: string, poolName: string) => {
    if (onAddNode) {
      onAddNode(nodeName, poolName);
      // On mobile viewports, auto-close the drawer so user sees canvas
      if (isMobile) {
        setIsOpen(false);
      }
    }
  };

  // Filtered & curated ordered pools
  const sortedAndFilteredPools = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const result: { poolName: string; label: string; keys: string[] }[] = [];

    // Collect all pools present in nodesPool
    const poolKeys = Object.keys(nodesPool);
    const orderedKeys = [
      ...CATEGORY_ORDER.filter((k) => poolKeys.includes(k)),
      ...poolKeys.filter((k) => !CATEGORY_ORDER.includes(k)),
    ];

    orderedKeys.forEach((poolName) => {
      const poolObj = (nodesPool as any)[poolName];
      if (!poolObj) return;

      const keys = Object.keys(poolObj).filter((k) => {
        if (!q) return true;
        const label = CATEGORY_LABELS[poolName] || poolName;
        return k.toLowerCase().includes(q) || poolName.toLowerCase().includes(q) || label.toLowerCase().includes(q);
      });

      if (keys.length > 0) {
        result.push({
          poolName,
          label: CATEGORY_LABELS[poolName] || poolName.replace("Nodes", ""),
          keys,
        });
      }
    });

    return result;
  }, [searchQuery]);

  return (
    <>
      {/* Floating Toggle Button when closed */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: "fixed",
            left: 0,
            top: isMobile ? "52px" : "56px",
            zIndex: 1000,
            backgroundColor: "#161925",
            border: "1px solid #282d42",
            borderLeft: "none",
            borderTopRightRadius: "8px",
            borderBottomRightRadius: "8px",
            color: "#60a5fa",
            padding: "10px 10px",
            minHeight: "44px",
            minWidth: "44px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            boxShadow: "2px 6px 16px rgba(0, 0, 0, 0.5)",
            touchAction: "manipulation",
          }}
          title="Open Nodes Palette"
          aria-label="Open Nodes Palette"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.02em" }}>Nodes</span>
          <span style={{ fontSize: "10px", color: "#94a3b8" }}>▶</span>
        </button>
      )}

      {/* Mobile Backdrop Overlay */}
      {isOpen && isMobile && (
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

      {/* Main Sidebar Drawer */}
      <aside
        style={{
          position: "fixed",
          top: "44px",
          bottom: 0,
          left: 0,
          width: isMobile ? "min(300px, 86vw)" : "230px",
          backgroundColor: "#0d0f17",
          borderRight: "1px solid #1f2333",
          zIndex: isMobile ? 9999 : 1000,
          display: isOpen ? "flex" : "none",
          flexDirection: "column",
          fontFamily: "'Inter', sans-serif",
          userSelect: "none",
          boxShadow: isMobile ? "6px 0 25px rgba(0, 0, 0, 0.6)" : "none",
          transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Sidebar Header */}
        <div
          style={{
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #1c2030",
            minHeight: "44px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#f8fafc" }}>
              Nodes Library
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {/* Expand / Collapse All Toggles */}
            <button
              onClick={expandAll}
              style={{
                background: "transparent",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                fontSize: "10px",
                fontWeight: 600,
                padding: "2px 4px",
                borderRadius: "4px",
              }}
              title="Expand All Groups"
            >
              All ▼
            </button>
            <button
              onClick={collapseAll}
              style={{
                background: "transparent",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                fontSize: "10px",
                fontWeight: 600,
                padding: "2px 4px",
                borderRadius: "4px",
              }}
              title="Collapse All Groups"
            >
              All ▶
            </button>

            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                fontSize: "16px",
                lineHeight: 1,
                minWidth: "32px",
                minHeight: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "4px",
                touchAction: "manipulation",
              }}
              title="Close Nodes Palette"
              aria-label="Close Nodes Palette"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div style={{ padding: "8px 12px" }}>
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              backgroundColor: "#141722",
              border: "1px solid #232738",
              borderRadius: "6px",
              padding: "6px 8px",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Filter nodes (e.g. mix, sin, uv)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                backgroundColor: "transparent",
                border: "none",
                outline: "none",
                color: "#e2e8f0",
                fontSize: "11px",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  background: "none",
                  border: "none",
                  color: "#64748b",
                  fontSize: "12px",
                  cursor: "pointer",
                  padding: "0 2px",
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Top Quick Actions: Custom Node & Import GLSL */}
        <div style={{ padding: "0 12px 8px 12px", display: "flex", gap: "6px" }}>
          <button
            onClick={() => {
              onOpenCustomNodeForm();
              if (isMobile) setIsOpen(false);
            }}
            style={{
              flex: 1,
              padding: "6px 8px",
              fontSize: "11px",
              fontWeight: 600,
              backgroundColor: "#161a26",
              border: "1px solid #24293d",
              borderRadius: "6px",
              color: "#94a3b8",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              minHeight: "34px",
              touchAction: "manipulation",
            }}
          >
            <span>+ Custom</span>
          </button>
          <button
            onClick={() => {
              onOpenImportGLSL();
              if (isMobile) setIsOpen(false);
            }}
            style={{
              flex: 1,
              padding: "6px 8px",
              fontSize: "11px",
              fontWeight: 600,
              backgroundColor: "#161a26",
              border: "1px solid #24293d",
              borderRadius: "6px",
              color: "#60a5fa",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              minHeight: "34px",
              touchAction: "manipulation",
            }}
          >
            <span>↓ Import</span>
          </button>
        </div>

        {/* Touch Tip on Mobile */}
        {isMobile && (
          <div
            style={{
              padding: "4px 12px 8px 12px",
              fontSize: "10px",
              color: "#64748b",
              textAlign: "center",
            }}
          >
            Tap any node to place it directly on canvas
          </div>
        )}

        {/* Accordion Categories List */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0 8px 24px 8px",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {sortedAndFilteredPools.map(({ poolName, label, keys }) => {
            const isExpanded = searchQuery ? true : expandedCategories[poolName] ?? true;

            return (
              <div key={poolName} style={{ marginBottom: "4px" }}>
                {/* Category Header */}
                <div
                  onClick={() => toggleCategory(poolName)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "7px 8px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    color: isExpanded ? "#f8fafc" : "#94a3b8",
                    backgroundColor: isExpanded ? "rgba(30, 98, 255, 0.08)" : "transparent",
                    fontSize: "11px",
                    fontWeight: 600,
                    transition: "all 0.15s ease",
                    minHeight: "36px",
                    touchAction: "manipulation",
                  }}
                  onMouseEnter={(e) => {
                    if (!isExpanded) e.currentTarget.style.backgroundColor = "#141722";
                  }}
                  onMouseLeave={(e) => {
                    if (!isExpanded) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                      style={{
                        fontSize: "9px",
                        color: isExpanded ? "#60a5fa" : "#64748b",
                        transition: "transform 0.15s ease",
                        display: "inline-block",
                      }}
                    >
                      {isExpanded ? "▼" : "▶"}
                    </span>
                    <span>{label}</span>
                  </div>
                  <span
                    style={{
                      fontSize: "10px",
                      color: isExpanded ? "#93c5fd" : "#64748b",
                      padding: "1px 6px",
                      backgroundColor: isExpanded ? "rgba(30, 98, 255, 0.18)" : "#141722",
                      borderRadius: "8px",
                      fontWeight: 600,
                    }}
                  >
                    {keys.length}
                  </span>
                </div>

                {/* Node Items List */}
                {isExpanded && (
                  <div
                    style={{
                      paddingLeft: "8px",
                      paddingTop: "2px",
                      paddingBottom: "4px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    {keys.map((name) => (
                      <div
                        key={name}
                        draggable
                        onDragStart={(e) => handleDragStart(e, name, poolName)}
                        onClick={() => handleNodeClick(name, poolName)}
                        style={{
                          padding: "6px 8px",
                          fontSize: "11px",
                          color: "#cbd5e1",
                          borderRadius: "4px",
                          cursor: "pointer",
                          transition: "all 0.12s ease",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          minHeight: "32px",
                          touchAction: "manipulation",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#1b2030";
                          e.currentTarget.style.color = "#ffffff";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                          e.currentTarget.style.color = "#cbd5e1";
                        }}
                        title={`Click or drag to add ${name} to graph`}
                      >
                        <span
                          style={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            flex: 1,
                          }}
                        >
                          {name}
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            color: "#60a5fa",
                            opacity: 0.6,
                            marginLeft: "4px",
                            flexShrink: 0,
                          }}
                          title="Add to canvas"
                        >
                          +
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
};
