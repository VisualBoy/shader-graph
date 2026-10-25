# Changelog

All notable changes to the **TSL & GLSL Shader Graph Editor** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.1.0] - 2026-10-25

- **Left Sidebar Unfolded Main Groups & Curated Order:**
  - Expanded primary node groups by default: **Constants**, **Math Operations**, **Attributes**, **Uniforms**, **Material Outputs**, **Logic & Branching**, **Varyings**, and **Position & View**.
  - Added "Expand All" and "Collapse All" controls in the sidebar header.
  - Added **Tap-to-Add** support: clicking or tapping any node in the palette immediately places it at the user's visible canvas center, enabling full tablet and smartphone touch usage without HTML5 drag-and-drop constraints.
- **Tablet & Mobile Layout Overhaul:**
  - **Responsive Header**: Added quick drawer toggle buttons (`☰ Nodes` and `👁 Preview`), shortened mode badges (`GLSL` / `TSL`), and hidden desktop-only tabs on screens under 768px.
  - **Collapsible 3D Preview Panel**: Transformed `RightPanel` into a collapsible drawer on mobile/tablet viewports with backdrop overlay, prominent close button, and floating toggle tab.
  - **Touch-Friendly Controls**: Enhanced hitboxes ($\ge 44\text{px}$) with `touch-action: manipulation` across the floating toolbar, quick-add menu, and code inspector drawer.
- **GLSL Type Promotion & Safe Output Casting:**
  - Added expression type inference (`portTypeMap` and `getTypeFromExpr`) in `GLSLBackend`.
  - Auto-promotes scalar floats, `vec2`, and `vec3` to valid `vec4` for the fragment output (`fragColor = vec4(expr, 1.0)` / `vec4(vec3(expr), 1.0)`), eliminating WebGL `dimension mismatch` compilation errors.
- **Application Error Boundary:**
  - Wrapped root app in a resilient React `ErrorBoundary` with reload and reset actions, preventing white-screen crashes from malformed graphs.
- **High-Contrast SVG Floating Toolbar:**
  - Modernized canvas controls (Zoom In, Zoom Out, Reset View, Quick Add) with crisp, accessible SVG vector icons and dark translucent glassmorphism design.

### Fixed
- **Emotion SSR Pseudoclass Warning:**
  - Replaced unsafe `:first-child` selector with `:first-of-type` in `src/nodl-react/components/Node/Node.styles.ts` to ensure clean React rendering without hydration warnings.
- **RightPanel `tslBackend` Reference Error:**
  - Resolved `ReferenceError: tslBackend is not defined` by adding the missing `tslBackend` import and guarding code emission compilation in a defensive `try...catch` block.
- **Corrupted Storage Deserialization:**
  - Hardened `CircuitStore.loadFromJson` and `Node.fromJson` against non-JSON inputs and stale schema states, ensuring clean fallback to default starter circuits.
- **WebGL2 Preview Error Piping:**
  - Captured shader info logs and syntax errors during `gl.compileShader` and `gl.linkProgram`, surfacing actionable diagnostic alerts directly in the editor UI.

---

## [2.0.0] - 2026-10-24

### Added - Dual-Engine Architecture & GLSL Compilation
- **Unified `ShaderBackend` Abstraction Layer:**
  - Created modular interface decoupling the visual node graph AST from the target output language.
  - Implemented `GLSLBackend` to compile node graph topologies directly to native `#version 300 es` GLSL vertex and fragment shaders.
  - Maintained `TSLBackend` for Three.js Shading Language / WebGPU output.
- **Native WebGL2 Preview Viewport (`WebGLPreview`):**
  - High-performance WebGL2 context rendering without Three.js overhead.
  - Real-time shader hot-reloading with per-frame uniform updates (`u_time`, `u_resolution`, `u_mouse`).
  - Switchable preview geometries: **Sphere**, **Cube**, **Plane**, and **Fullscreen Quad**.
  - Built-in mouse orbit controls (pan, rotate, zoom) and grid/wireframe overlays.
- **GLSL-to-Graph Reverse Transpiler (`GLSLParser`):**
  - Added AST lexer and parser to import raw GLSL ES 3.0 source code into the editor.
  - Automatically reconstructs `nodl` DAG node topologies, resolves variable bindings, creates uniform/varying inputs, and wires graph connections.
  - Added interactive "Import GLSL" modal with preset shaders (Plasma, Raymarcher, Procedural Noise).
- **Dual-Mode Workspace Toggle:**
  - Header toggle switch enabling instant switching between **WebGL2 (GLSL)** and **Three.js (TSL)** modes.
- **Live Code Inspector Drawer:**
  - Bottom expandable dock with tabbed syntax-highlighted views for **Vertex Shader**, **Fragment Shader**, and **TSL JavaScript**.
  - Copy-to-clipboard functionality and live line numbering.
- **Expanded Generic Shader Node Catalog:**
  - Attribute nodes: `Position`, `Normal`, `UV`, `VertexColor`.
  - Uniform nodes: `Time`, `Resolution`, `Mouse`, `Float Uniform`, `Vec2 Uniform`, `Vec3 Uniform`, `Vec4 Uniform`.
  - Math & Vector nodes: `Dot`, `Cross`, `Normalize`, `Length`, `Distance`, `Reflect`, `Refract`, `Pow`, `Sqrt`, `Exp`, `Sin`, `Cos`, `Tan`, `Abs`, `Floor`, `Ceil`, `Fract`, `Clamp`, `Mix`, `Smoothstep`, `Step`.
  - Logic & Comparison nodes: `If/Else`, `Greater Than`, `Less Than`, `Equal`, `Min`, `Max`.
  - Texture & Sampling nodes: `Texture2D Sampler`, `UV Transform`.

---

## [1.1.0] - 2026-10-20

### Added
- **Quick-Add Search Menu:**
  - Press <kbd>Space</kbd> or right-click anywhere on the canvas to open a categorized fuzzy-search node palette.
- **Circuit Persistence:**
  - Graph state auto-saved to browser `localStorage`.
  - Export and import circuit graphs as portable `.json` files.
- **Custom Node Support:**
  - Create arbitrary expression nodes with user-defined input ports, output types, and custom code expressions.

### Improved
- Canvas pan and zoom performance with large node graphs.
- Connection bezier curve smoothing and snap-to-port accuracy.

---

## [1.0.0] - 2026-10-15

### Initial Release
- Visual node graph authoring interface based on `@nodl/core` and `@nodl/react`.
- Three.js Node Material (TSL) compilation targeting WebGPU / WebGL renderer.
- Fundamental node library: Float, Vector, Color, Add, Multiply, Sub, Div.
- 3D mesh preview with Leva inspector controls.
