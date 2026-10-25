import React, { useState, useMemo, useRef, useEffect } from "react";
import { nodesPool } from "../nodes";
import { CircuitStore } from "../nodl-react";
import { EditorEventEmitter } from "../nodes/utils";

interface QuickAddMenuProps {
  store: CircuitStore;
  isOpen: boolean;
  onClose: () => void;
  position?: { x: number; y: number };
}

export const QuickAddMenu: React.FC<QuickAddMenuProps> = ({
  store,
  isOpen,
  onClose,
  position,
}) => {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  // Close on outside click or Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Aggregate and filter all nodes from pools
  const allNodes = useMemo(() => {
    const list: { name: string; pool: string }[] = [];
    Object.entries(nodesPool).forEach(([poolName, pool]) => {
      if (!pool) return;
      Object.keys(pool).forEach((nodeName) => {
        list.push({ name: nodeName, pool: poolName });
      });
    });
    return list;
  }, []);

  const filteredNodes = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return allNodes;
    return allNodes.filter(
      (n) => n.name.toLowerCase().includes(q) || n.pool.toLowerCase().includes(q)
    );
  }, [allNodes, query]);

  if (!isOpen) return null;

  const handleSelectNode = (nodeName: string, poolName: string) => {
    const pool = nodesPool[poolName as keyof typeof nodesPool];
    if (!pool) return;
    const NodeClass = (pool as any)[nodeName];
    if (!NodeClass) return;

    const nodeInstance = new NodeClass();
    // Default spawn coordinate near screen center or click position
    const spawnX = position?.x ?? (Math.random() * 200 - 100);
    const spawnY = position?.y ?? (Math.random() * 200 - 100);

    store.setNodes([[nodeInstance, { x: spawnX, y: spawnY }]]);
    EditorEventEmitter.emit("changed");
    EditorEventEmitter.emit("forceRender");
    store.save();
    onClose();
  };

  const isSmallScreen = typeof window !== "undefined" && window.innerWidth < 640;
  const stylePos = isSmallScreen || !position
    ? {
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(320px, 90vw)",
      }
    : {
        left: `${Math.min(Math.max(position.x, 240), window.innerWidth - 320)}px`,
        top: `${Math.min(Math.max(position.y, 60), window.innerHeight - 360)}px`,
        width: "260px",
      };

  return (
    <>
      {/* Backdrop overlay for mobile/tablet */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: isSmallScreen ? "rgba(0, 0, 0, 0.65)" : "transparent",
          backdropFilter: isSmallScreen ? "blur(3px)" : "none",
          zIndex: 99998,
        }}
      />
      <div
        ref={containerRef}
        style={{
          position: "fixed",
          ...stylePos,
          maxHeight: isSmallScreen ? "70vh" : "360px",
          backgroundColor: "#161925",
          border: "1px solid #282d42",
          borderRadius: "8px",
          boxShadow: "0 16px 40px rgba(0, 0, 0, 0.7)",
          zIndex: 99999,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "'Inter', sans-serif",
        }}
      >
      {/* Search Header */}
      <div style={{ padding: "8px 10px", borderBottom: "1px solid #24293d", display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ color: "#64748b", fontSize: "12px" }}>🔍</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search nodes..."
          style={{
            width: "100%",
            backgroundColor: "transparent",
            border: "none",
            outline: "none",
            color: "#e2e8f0",
            fontSize: "12px",
          }}
        />
      </div>

      {/* Node Results List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px" }}>
        {filteredNodes.length > 0 ? (
          filteredNodes.map(({ name, pool }) => (
            <div
              key={`${pool}-${name}`}
              onClick={() => handleSelectNode(name, pool)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 8px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px",
                color: "#cbd5e1",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#242a3e";
                e.currentTarget.style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "#cbd5e1";
              }}
            >
              <span>{name}</span>
              <span style={{ fontSize: "10px", color: "#64748b" }}>
                {pool.replace("Nodes", "")}
              </span>
            </div>
          ))
        ) : (
          <div style={{ padding: "12px", textAlign: "center", color: "#64748b", fontSize: "11px" }}>
            No nodes found
          </div>
        )}
      </div>

      {/* Footer Helper */}
      <div
        style={{
          padding: "6px 10px",
          backgroundColor: "#10131d",
          borderTop: "1px solid #1f2333",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "10px",
          color: "#64748b",
        }}
      >
        <span>fx Type expressions to create graphs</span>
        <span style={{ color: "#3b82f6" }}>Syntax</span>
      </div>
    </div>
  </>
);
};
