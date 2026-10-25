# Refactor TSL Editor for Generic WebGL / GLSL ES 3.0 Shader Authoring & Bidirectional GLSL Import

Decouple the graph-based shader editor from Three.js TSL by introducing a unified `ShaderBackend` architecture, topological GLSL ES 3.0 compiler, native WebGL2 preview renderer with switchable geometries, real-time code inspection drawer, and a **GLSL-to-Graph Reverse Transpilation & AST Parser** to import existing shaders directly into the `nodl` node canvas.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were confirmed during Phase 1 clarification and user revision:
> - **Dual Mode Backend Switching**: The workspace header features a dual-mode toggle between **GLSL (WebGL2)** and **TSL (Three.js WebGPU)**, defaulting to GLSL ES 3.0 as the primary authoring target.
> - **Bidirectional GLSL-to-Graph Parser (Reverse Transpilation)**: An AST parsing and graph reconstruction engine (`src/parser/GLSLParser.ts`) allows importing `.glsl` files or pasting raw GLSL shader code to automatically recreate the visual node graph, wire ports, and configure uniforms.
> - **Viewport Geometries**: The WebGL2 preview pipeline supports interactive switching across four geometry targets: **Sphere**, **Cube**, **Plane**, and **Fullscreen Quad** (ideal for Shadertoy-style raymarching/procedural canvas effects).
> - **Live Code Inspection**: Real-time shader output is displayed in a collapsible, bottom-anchored inspection drawer with tabs for **Vertex Shader (GLSL 3.0)**, **Fragment Shader (GLSL 3.0)**, and **TSL Code**.
> - **Compilation Feedback**: Real-time GLSL compilation logs (`getShaderInfoLog`, line-specific errors) are intercepted and surfaced directly in an inline status banner on the preview and code inspection views.

---

## 1. Overview & Core Concept

- **What It Does**: Transforms the editor from a unidirectional Three.js-exclusive WebGPU tool into a full-featured, bidirectional visual shader authoring environment. Users can either construct node graphs visually to generate standard **GLSL ES 3.0** (`#version 300 es`) and **TSL**, or paste/import existing GLSL vertex and fragment shaders to automatically generate and wire corresponding nodes on the canvas.
- **Target Audience**: Technical artists, graphics engineers, creative coders, and web developers building WebGL2/WebGPU shaders, post-processing filters, or procedural materials.
- **Key Value**: True two-way workflow: import existing shaders (or Shadertoy snippets) into interactive nodes, manipulate them visually, preview in real time on 3D meshes or 2D quads with native WebGL2, and re-export clean GLSL or TSL.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Target Selection**: Users toggle between `GLSL (WebGL2)` and `TSL (Three.js)` via the top header bar. Active mode shifts the preview renderer, node code generator, and inspector tabs.
2. **Importing Existing Shaders (GLSL -> Graph)**:
   - User clicks **"Import GLSL"** in the top navigation.
   - An interactive modal (`CodePasteModal`) opens with tabs for Fragment or Vertex GLSL code, with preset templates (e.g. Simple Color, Gradient, Noise, Texture Blend).
   - Upon clicking "Build Graph", the parser tokenizes the GLSL source, extracts uniform declarations, assigns expressions to node types (`Mix`, `Mul`, `Add`, `UV`, `TextureUniform`, etc.), computes layout positions on the canvas, wires inputs/outputs, and mounts the graph into `nodl`.
3. **Graph Construction & Live Authoring**:
   - Drag & drop math operators, uniform nodes (`u_time`, `u_resolution`, `u_mouse`), texture samplers, and attributes onto the canvas. Connecting nodes automatically triggers incremental graph compilation.
4. **Real-time Previewing**:
   - The top-right preview panel renders the active shader live.
   - A geometry picker allows switching between Sphere, Cube, Plane, and Fullscreen Quad, with mouse orbit controls and automatic uniform binding (`u_time`, `u_resolution`, `u_mouse`).
5. **Code Inspection**:
   - Expanding the bottom code drawer reveals real-time compiled GLSL (Vertex & Fragment) or TSL with syntax highlighting, one-click copy, and line-mapped compiler error callouts.

### Visual Identity & Theme
- **Aesthetic Direction**: High-density creative development environment inspired by modern professional tools (Blender Shader Editor, Unreal Material Graph, Cables.gl).
- **Color Palette**:
  - Dominant Canvas: Deep obsidian background (`#12141c`) with dark panel surfaces (`#1c1e2a`, `#242736`).
  - Hairline Borders: Muted subtle borders (`#34384e`, `#2a2f3e`).
  - Accents: Vibrant cobalt blue (`#1e62ff`) for active controls and links, emerald green (`#10b981`) for compilation success badges, and crimson red (`#ef4444`) for shader syntax errors.
- **Typography & Hierarchy**:
  - Primary UI: `Inter` clean grotesque sans for labels, tabs, and buttons.
  - Code & Math: Monospace font (`JetBrains Mono`, `Fira Code`, or `ui-monospace`) with tabular numerals for coordinates, uniforms, and code inspection.
- **Layout Rhythm**:
  - Top Bar: Left wordmark (`TSL / GLSL Studio`), centered mode toggle (`GLSL ES 3.0` | `TSL WebGPU`), "Import GLSL" action button, right save & status indicators.
  - Left Dock: Node library with categorized accordions (Materials, Inputs, Math, Position, Uniforms, Logic, Custom).
  - Center: Infinite canvas with smooth pan/zoom and nodl connection cables.
  - Top-Right: Pinned interactive 3D/Quad viewport with geometry switcher and orbit controls.
  - Bottom Dock: Collapsible code inspection drawer with tabs for `Vertex`, `Fragment`, `TSL`, and `Compiler Log`.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Dual-Context Preview Architecture (WebGL2 + Three.js WebGPU)**
  - *Chosen Approach*: Implement a dedicated `WebGL2Renderer` class alongside the existing Three.js `Experience` class, mediated by the `ShaderBackend` interface.
  - *Why*: Three.js WebGPU node material compilation operates differently from standard WebGL2 program linking (`gl.compileShader`, `gl.linkProgram`). A native WebGL2 renderer guarantees 100% valid GLSL ES 3.0 execution and zero hidden Three.js runtime overhead.

- **Decision 2: AST Reverse Transpiler Strategy**
  - *Chosen Approach*: Implement a modular AST tokenizer and statement parser that processes GLSL ES 3.0 function bodies, variable declarations, binary/unary expressions, and function calls into a clean Directed Acyclic Graph (DAG) with auto-layout coordinates for `nodl`.
  - *Why*: Allows importing real-world shaders, provides graceful fallback for unmapped expressions into custom function nodes or comment warnings, and prevents editor lock-in.

- **Decision 3: Topological Graph-to-GLSL Compiler**
  - *Chosen Approach*: Recursive dependency traversal algorithm starting from the Material output node (`MeshStandardMaterialNode` / `GLSLOutputNode`), resolving execution order, assigning distinct variable names (`v_...`, `tmp_...`), and injecting necessary header boilerplate (precision qualifiers, uniforms, varying declarations).
  - *Why*: Eliminates variable collisions, respects GLSL declaration-before-use ordering, and handles dead code pruning.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            EDITOR TOP BAR                                   │
│  [GLSL ES 3.0 / TSL Mode Toggle]    [Import GLSL Button]    [Compile Status] │
└─────────────────────────────────────────────────────────────────────────────┘
          │                                                  ▲
          │ Import Code                                      │
          ▼                                                  │
┌─────────────────────────┐                                  │
│   GLSL PARSER (AST)     │                                  │
│   (GLSL -> Graph DAG)   │                                  │
│ • Tokenize declarations │                                  │
│ • Parse statements      │                                  │
│ • Auto-layout positions │                                  │
└─────────────────────────┘                                  │
          │                                                  │
          ▼ Construct Nodes & Wire Ports                     │
┌─────────────────────────┐                        ┌─────────────────────────┐
│     NODE GRAPH AST      │                        │    PREVIEW VIEWPORT     │
│  (nodl-core & react)    │                        │   (Sphere/Cube/Quad)    │
│                         │                        │                         │
│ • Attribute Nodes       │                        │ • WebGL2 Context        │
│ • Uniform Nodes         │                        │ • Program Linker        │
│ • Math & Vector Nodes   │                        │ • Uniforms: time, mouse │
│ • Material Output Node  │                        │ • Shader Error Overlay  │
└─────────────────────────┘                        └─────────────────────────┘
        │                                                        ▲
        │ Topological Sort & Emit                                │ Load Program
        ▼                                                        │
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SHADER BACKEND LAYER                               │
│                                                                             │
│   ┌──────────────────────────────┐        ┌──────────────────────────────┐  │
│   │         GLSLBackend          │        │          TSLBackend          │  │
│   │ • Generates Vertex GLSL 3.0  │        │ • Evaluates Three.js TSL AST │  │
│   │ • Generates Fragment GLSL 3.0│        │ • Updates Node Material      │  │
│   │ • Extracts Active Uniforms   │        │ • WebGPU Pipeline            │  │
│   │ • Type Inference & Intrinsics│        └──────────────────────────────┘  │
│   └──────────────────────────────┘                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BOTTOM CODE INSPECTION DRAWER                            │
│  [Tab: Fragment GLSL]  [Tab: Vertex GLSL]  [Tab: TSL]  [Tab: Compiler Log]  │
│  • Syntax Highlighting (highlight.js)                                      │
│  • One-Click Clipboard Copy                                                 │
│  • Error line indicators                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. GLSL-to-Graph Parser & Reverse Transpilation Module (`src/parser/GLSLParser.ts`)

### Parser Components & Pipeline

1. **Tokenization & Grammar Decomposition**:
   - Parses top-level uniform declarations (e.g. `uniform float u_time;`, `uniform vec2 u_resolution;`, `uniform sampler2D u_texture;`).
   - Parses varying declarations (`in vec2 v_uv;`, `out vec4 fragColor;`).
   - Identifies the entry point function (`void main() { ... }`) and extracts statements in sequence.

2. **Expression AST to Node Mapping**:
   - Binary operations (`+`, `-`, `*`, `/`) $\rightarrow$ `Add`, `Sub`, `Mul`, `Div` nodes.
   - Vector constructors (`vec2(...)`, `vec3(...)`, `vec4(...)`) $\rightarrow$ `Vec2`, `Vec3`, `Vec4` nodes.
   - Built-in GLSL math calls:
     - `mix(a, b, t)` $\rightarrow$ `Mix` node.
     - `dot(a, b)` $\rightarrow$ `Dot` node.
     - `cross(a, b)` $\rightarrow$ `Cross` node.
     - `normalize(v)` $\rightarrow$ `Normalize` node.
     - `sin`, `cos`, `fract`, `floor`, `clamp`, `smoothstep`, `length`, `distance` $\rightarrow$ corresponding Math nodes.
   - Built-in inputs:
     - `v_uv`, `uv` $\rightarrow$ `UV` node.
     - `v_normal`, `normal` $\rightarrow$ `Normal` node.
     - `texture(sampler, uv)` $\rightarrow$ `TextureUniform` node.
   - Output assignments:
     - Assignments to `fragColor` / `gl_FragColor` are wired into the `MeshStandardMaterialNode` or `GLSLOutputNode` color inputs.

3. **DAG Dependency Wiring & Auto-Layout**:
   - Tracks local variable assignments in an environment symbol table (e.g. `vec3 col = ...;`).
   - Subsequent usages resolve to the output port of the node producing that variable.
   - Implements horizontal column layout math ($\Delta X = 280\text{px}$, $\Delta Y = 160\text{px}$) to neatly position input/uniform nodes on the left, intermediate math nodes in the middle, and output nodes on the right.

4. **UI Import Interface**:
   - Top-bar "Import GLSL" button opens a dark modal with a code editor area.
   - Includes quick sample presets (e.g., "Sine Wave Color", "Radial Gradient", "Checkerboard", "Normal Visualizer").
   - Syntax validation and friendly error handling when unsupported statements or unparseable constructs are encountered.

---

## 6. Subsystems to Implement

1. **`src/backends/ShaderBackend.ts`**:
   - Unified interface defining `compile(graph: NodeGraph): CompilationResult`.
   - Unified uniform descriptors and active backend lifecycle manager.
2. **`src/backends/GLSLBackend.ts`**:
   - Topological sorting and AST emission for standard `#version 300 es` shaders.
3. **`src/backends/TSLBackend.ts`**:
   - Encapsulation of Three.js TSL emission for seamless backward-compatibility.
4. **`src/parser/GLSLParser.ts`**:
   - Robust tokenizer, statement extractor, node factory mapper, and circuit store injector.
5. **`src/components/WebGLPreview.ts`**:
   - Native WebGL2 context manager, shader program compiler, error log extractor, and geometry manager (Sphere, Cube, Plane, Fullscreen Quad).
6. **`src/components/CodeInspector.tsx`**:
   - Collapsible bottom drawer with syntax-highlighted tabs for Vertex GLSL, Fragment GLSL, TSL, and Compiler Logs.
7. **`src/components/ImportGLSLModal.tsx`**:
   - Clean dialog allowing users to paste GLSL code, pick templates, and reconstruct graphs.
