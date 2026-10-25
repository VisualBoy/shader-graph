# TSL & GLSL Shader Graph Editor

[![WebGL 2.0](https://img.shields.io/badge/WebGL-2.0%20%2F%20GLSL%20ES%203.0-blue.svg?logo=webgl)](https://www.khronos.org/webgl/)
[![Three.js](https://img.shields.io/badge/Three.js-r172%20(TSL%20%2F%20WebGPU)-black.svg?logo=three.js)](https://threejs.org/)
[![React](https://img.shields.io/badge/React-18.3.1-61dafb.svg?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646cff.svg?logo=vite)](https://vitejs.dev/)

A visual, node-based shader authoring studio supporting both **Native WebGL2 / GLSL ES 3.0** and **Three.js Shading Language (TSL / WebGPU)**. 

Design complex shaders visually using a reactive Directed Acyclic Graph (DAG), preview them in real time across multiple 3D geometries, inspect live-compiled shader code, and transpile existing GLSL code directly into visual nodes.

---

## Highlights & Features

### 1. Dual-Backend Architecture
Seamlessly switch between targets using the header mode toggle:
- **WebGL2 / GLSL ES 3.0 Backend (`GLSLBackend`):** Compiles the visual node graph into production-ready `#version 300 es` vertex and fragment shaders with precision qualifiers, uniform layouts, attribute bindings, and auto-promoted type safety.
- **Three.js TSL Backend (`TSLBackend`):** Compiles graphs into modern Three.js Node Material syntax, ready for WebGPU and Three.js r170+ renderers.

### 2. High-Performance Real-Time 3D Viewport
- **Native WebGL2 Context:** Zero-overhead raw WebGL2 preview pipeline with real-time shader re-compilation on graph mutation.
- **Switchable Geometries:** Test materials on a **Sphere**, **Cube**, **Plane**, or **Fullscreen Quad**.
- **Interactive Orbit Controls:** Pan, rotate, zoom, and reset views directly with intuitive mouse controls.
- **Dynamic Uniform Feed:** Per-frame automatic updates for `u_time` (elapsed seconds), `u_resolution` (canvas dimensions), and `u_mouse` (normalized cursor coordinates).
- **Compilation Diagnostics HUD:** Instant visual alerts with line-level compiler logs when syntax or linking issues occur.

### 3. Bidirectional Shader Engineering (GLSL to Graph)
- **Reverse Transpilation Engine (`GLSLParser`):** Paste or import arbitrary GLSL ES 3.0 fragment shaders. The AST parser analyzes functions, operators, uniforms, and local variables to automatically reconstruct the visual node topology and connections on the canvas.
- **Preset Library:** Jump-start creation with included presets (Plasma waves, Raymarched primitives, Animated noise, Color gradients).

### 4. Live Code Inspection
- **Expandable Bottom Drawer:** Live-updating multi-tab inspector displaying:
  - **Vertex Shader** (`.vert` GLSL ES 3.0)
  - **Fragment Shader** (`.frag` GLSL ES 3.0)
  - **Three.js TSL** (JavaScript module code)
- **Syntax Highlighting & Formatting:** Highlighted syntax with instant copy-to-clipboard buttons.

### 5. Comprehensive Node Registry
Over 40+ specialized nodes organized by domain:
- **Constants:** Float, Vector2, Vector3, Vector4, Color Picker, Boolean, Integer.
- **Attributes:** Vertex Position, Normal, UV Coordinates, Vertex Color.
- **Uniforms:** Time (`u_time`), Resolution (`u_resolution`), Mouse (`u_mouse`), Custom Uniform Floats and Vectors.
- **Math Operations:** Add, Subtract, Multiply, Divide, Modulo, Power, Square Root, Exponential, Absolute, Negate.
- **Trigonometry:** Sine, Cosine, Tangent, Asin, Acos, Atan, Radians, Degrees.
- **Vector Intrinsics:** Dot Product, Cross Product, Normalize, Length, Distance, Reflect, Refract.
- **Interpolation & Range:** Mix (Lerp), Clamp, Smoothstep, Step, Min, Max, Fract, Floor, Ceil.
- **Logic & Control:** Conditional (If/Else), Greater Than, Less Than, Equals.
- **Textures & Varyings:** 2D Texture Sampler, UV Tiling & Offset, Varying Pass-through.
- **Custom Nodes:** Define arbitrary multi-port logic with custom code expressions.

---

## Architecture Overview

```
src/
├── backends/               # Target language emitters
│   ├── ShaderBackend.ts    # Abstract interface & common types
│   ├── GLSLBackend.ts      # GLSL ES 3.0 code generator & type inferrer
│   └── TSLBackend.ts       # Three.js Node Material (TSL) emitter
├── parser/                 # Reverse transpiler
│   └── GLSLParser.ts       # GLSL ES 3.0 AST parser & DAG reconstructor
├── components/             # React UI & Viewports
│   ├── WebGLPreview.ts     # Native WebGL2 preview renderer & orbit controls
│   ├── Experience.ts       # Three.js scene & node material preview
│   ├── CodeInspector.tsx   # Real-time code previewer drawer (tabs: Vert, Frag, TSL)
│   ├── Header.tsx          # Dual mode toggle, preset loader, GLSL import modal
│   ├── NodesSidebar.tsx    # Categorized draggable node library
│   ├── CanvasToolbar.tsx   # SVG canvas controls (Zoom, Pan, Fit, Reset)
│   ├── QuickAddMenu.tsx    # Spacebar fuzzy search node creator
│   └── ImportGLSLModal.tsx # GLSL import dialogue with preset templates
├── nodes/                  # Node definitions (Inputs, Outputs, Compute)
│   ├── AttributeNodes.ts   # Position, Normal, UV
│   ├── ConstantNodes.ts    # Float, Vec2/3/4, Color
│   ├── UniformNodes.ts     # Time, Resolution, Custom Uniforms
│   ├── MathNodes.ts        # Math intrinsics & operations
│   ├── LogicNodes.ts       # Comparisons, branching, steps
│   └── CustomNode.ts       # User-defined expression nodes
└── nodl-core / nodl-react  # Reactive node-graph execution engine (MobX + RxJS)
```

---

## Keyboard Shortcuts & Canvas Navigation

| Action | Control |
| :--- | :--- |
| **Quick Add Node** | Press <kbd>Space</kbd> or **Right-Click** on canvas |
| **Pan Canvas** | **Middle Mouse Button** or **Left-Click + Drag** on canvas background |
| **Zoom In / Out** | **Mouse Wheel** scroll or Toolbar Zoom buttons |
| **Connect Ports** | Click and drag from an output port to an input port |
| **Disconnect Wire** | Click existing connection wire or pull off port |
| **Delete Selected Node** | Select node and press <kbd>Delete</kbd> or <kbd>Backspace</kbd> |
| **Reset View** | Click **Reset** in bottom floating toolbar |
| **Orbit 3D Preview** | Click and drag inside the 3D preview window |
| **Zoom 3D Preview** | Scroll wheel inside the 3D preview window |

---

## Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/bhushan6/tsl-editor.git
cd tsl-editor
npm install
```

### Development Server

Start the local development server with hot-reload:

```bash
npm run dev
```

Open your browser at `http://localhost:3000`.

### Production Build

Compile TypeScript and build the optimized production bundle with Vite:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

---

## Example: Building a Fresnel Shader

1. Press <kbd>Space</kbd> and add a **Normal** node (`AttributeNodes`).
2. Add a **Position** node (`AttributeNodes`).
3. Add a **Normalize** node and wire **Position** into it to obtain the view vector.
4. Add a **Dot** product node and connect **Normal** and the normalized view vector.
5. Add a **Clamp** node to bound the value between `0.0` and `1.0`.
6. Add a **Power** node with an exponent of `3.0` for a sharp rim effect.
7. Add a **Color** constant node and a **Multiply** node to tint the fresnel rim.
8. Wire the output into the **Fragment Color** output node.
9. Watch your shader update instantly on the 3D sphere preview in the top-right viewport!

---

## Contributing

Contributions, bug reports, and feature suggestions are welcome!
1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/amazing-shader-node`).
3. Commit your changes (`git commit -m 'Add new Voronoi noise node'`).
4. Push to the branch (`git push origin feature/amazing-shader-node`).
5. Open a Pull Request.

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
