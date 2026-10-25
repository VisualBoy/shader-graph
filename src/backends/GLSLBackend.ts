import { Node, Input } from "../nodl-core";
import { CompilationResult, IShaderBackend, UniformDescriptor } from "./ShaderBackend";
import { createVarNameForNode } from "../nodes/utils";

export class GLSLBackend implements IShaderBackend {
  public readonly type = "GLSL" as const;

  public compile(nodes: Node[]): CompilationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const uniforms: Record<string, UniformDescriptor> = {
      u_time: { name: "u_time", type: "float", value: 0 },
      u_resolution: { name: "u_resolution", type: "vec2", value: [800, 600] },
      u_mouse: { name: "u_mouse", type: "vec2", value: [0, 0] },
    };

    if (!nodes || nodes.length === 0) {
      return this.getDefaultShader();
    }

    // Map outputs to source nodes for DAG traversal
    const outputToNodeMap = new Map<string, { node: Node; outputName: string }>();
    nodes.forEach((node) => {
      Object.entries(node.outputs).forEach(([outputKey, output]) => {
        outputToNodeMap.set(output.id, { node, outputName: outputKey });
      });
    });

    // Find the primary sink / material node
    const materialNode = nodes.find(
      (n) =>
        n.name === "MeshStandardMaterialNode" ||
        n.name === "GLSLOutputNode" ||
        n.constructor.name === "MeshStandardMaterialNode" ||
        n.constructor.name === "GLSLOutputNode"
    );

    // If no explicit material node found, pick any terminal node with connected inputs
    const targetNode = materialNode || this.findTerminalNode(nodes);

    if (!targetNode) {
      return this.getDefaultShader();
    }

    // Topological traversal
    const visited = new Set<string>();
    const order: Node[] = [];

    const visit = (currNode: Node) => {
      if (visited.has(currNode.id)) return;
      visited.add(currNode.id);

      Object.values(currNode.inputs).forEach((input) => {
        if (input.connection) {
          const source = outputToNodeMap.get(input.connection.from.id);
          if (source) {
            visit(source.node);
          }
        }
      });

      order.push(currNode);
    };

    visit(targetNode);

    // Statement emitter
    const fragmentStatements: string[] = [];
    const customUniformDecls: string[] = [];
    const samplerDecls: string[] = [];

    // Track variable names and types per output port
    const portVarMap = new Map<string, string>();
    const portTypeMap = new Map<string, "float" | "vec2" | "vec3" | "vec4">();

    const getTypeFromExpr = (expr: string): "float" | "vec2" | "vec3" | "vec4" => {
      const clean = expr.trim();
      if (clean.startsWith("vec4") || clean.includes(".rgba")) return "vec4";
      if (clean.startsWith("vec3") || clean.includes(".rgb") || clean.includes("cross") || clean.includes("v_position") || clean.includes("v_normal")) return "vec3";
      if (clean.startsWith("vec2") || clean.includes(".xy") || clean.includes("v_uv")) return "vec2";
      return "float";
    };

    const promoteType = (
      t1: "float" | "vec2" | "vec3" | "vec4",
      t2?: "float" | "vec2" | "vec3" | "vec4"
    ): "float" | "vec2" | "vec3" | "vec4" => {
      if (!t2) return t1;
      const rank: Record<string, number> = { float: 1, vec2: 2, vec3: 3, vec4: 4 };
      return (rank[t1] || 1) >= (rank[t2] || 1) ? t1 : t2;
    };

    // Helper to format float literals as GLSL float (e.g. 1 -> 1.0)
    const toGLSLFloat = (val: any): string => {
      if (typeof val === "number") {
        return Number.isInteger(val) ? `${val}.0` : `${val}`;
      }
      const num = parseFloat(val);
      if (!isNaN(num)) {
        return Number.isInteger(num) ? `${num}.0` : `${num}`;
      }
      return "0.0";
    };

    order.forEach((node) => {
      const varName = createVarNameForNode(node);
      const nodeType = node.name || node.constructor.name;

      // Extract argument expressions from input connections or defaults
      const args: string[] = [];
      const argTypes: ("float" | "vec2" | "vec3" | "vec4")[] = [];
      const inputKeys = Object.keys(node.inputs);

      inputKeys.forEach((key) => {
        const input: Input = node.inputs[key];
        if (input.connection) {
          const fromId = input.connection.from.id;
          const assignedVar = portVarMap.get(fromId);
          const assignedType = portTypeMap.get(fromId) || (assignedVar ? getTypeFromExpr(assignedVar) : "float");
          if (assignedVar) {
            args.push(assignedVar);
            argTypes.push(assignedType);
          } else {
            args.push("0.0");
            argTypes.push("float");
          }
        } else {
          // Resolve static or default value
          try {
            const raw = typeof input.getValue === "function" ? input.getValue()() : input.defaultValue;
            if (typeof raw === "number") {
              args.push(toGLSLFloat(raw));
              argTypes.push("float");
            } else if (raw && typeof raw === "object") {
              if ("isVector2" in raw || ("x" in raw && "y" in raw && !("z" in raw))) {
                args.push(`vec2(${toGLSLFloat(raw.x)}, ${toGLSLFloat(raw.y)})`);
                argTypes.push("vec2");
              } else if ("isVector3" in raw || ("x" in raw && "y" in raw && "z" in raw && !("w" in raw))) {
                args.push(`vec3(${toGLSLFloat(raw.x)}, ${toGLSLFloat(raw.y)}, ${toGLSLFloat(raw.z)})`);
                argTypes.push("vec3");
              } else if ("isVector4" in raw || ("x" in raw && "y" in raw && "z" in raw && "w" in raw)) {
                args.push(`vec4(${toGLSLFloat(raw.x)}, ${toGLSLFloat(raw.y)}, ${toGLSLFloat(raw.z)}, ${toGLSLFloat(raw.w)})`);
                argTypes.push("vec4");
              } else {
                args.push("0.0");
                argTypes.push("float");
              }
            } else {
              args.push("0.0");
              argTypes.push("float");
            }
          } catch {
            args.push("0.0");
            argTypes.push("float");
          }
        }
      });

      // Map node expressions to GLSL
      switch (nodeType) {
        // Constants & Vectors
        case "Float": {
          const val = args[0] || "0.0";
          fragmentStatements.push(`    float ${varName} = ${val};`);
          if (node.outputs.value) {
            portVarMap.set(node.outputs.value.id, varName);
            portTypeMap.set(node.outputs.value.id, "float");
          }
          break;
        }
        case "Int": {
          const val = args[0] || "0";
          fragmentStatements.push(`    int ${varName} = int(${val});`);
          if (node.outputs.value) {
            portVarMap.set(node.outputs.value.id, varName);
            portTypeMap.set(node.outputs.value.id, "float");
          }
          break;
        }
        case "Vec2": {
          const x = args[0] || "0.0";
          const y = args[1] || "0.0";
          fragmentStatements.push(`    vec2 ${varName} = vec2(${x}, ${y});`);
          if (node.outputs.value) {
            portVarMap.set(node.outputs.value.id, varName);
            portTypeMap.set(node.outputs.value.id, "vec2");
          }
          break;
        }
        case "Vec3": {
          const x = args[0] || "0.0";
          const y = args[1] || "0.0";
          const z = args[2] || "0.0";
          fragmentStatements.push(`    vec3 ${varName} = vec3(${x}, ${y}, ${z});`);
          if (node.outputs.value) {
            portVarMap.set(node.outputs.value.id, varName);
            portTypeMap.set(node.outputs.value.id, "vec3");
          }
          break;
        }
        case "Vec4": {
          const x = args[0] || "0.0";
          const y = args[1] || "0.0";
          const z = args[2] || "0.0";
          const w = args[3] || "1.0";
          fragmentStatements.push(`    vec4 ${varName} = vec4(${x}, ${y}, ${z}, ${w});`);
          if (node.outputs.value) {
            portVarMap.set(node.outputs.value.id, varName);
            portTypeMap.set(node.outputs.value.id, "vec4");
          }
          break;
        }
        case "Color": {
          const hex = (node as any)._value?.value || "#3b82f6";
          const rgb = this.hexToRgb(hex);
          fragmentStatements.push(
            `    vec4 ${varName} = vec4(${toGLSLFloat(rgb.r)}, ${toGLSLFloat(rgb.g)}, ${toGLSLFloat(rgb.b)}, 1.0);`
          );
          if (node.outputs.value) {
            portVarMap.set(node.outputs.value.id, varName);
            portTypeMap.set(node.outputs.value.id, "vec4");
          }
          break;
        }
        case "SplitVec2": {
          const src = args[0] || "vec2(0.0)";
          fragmentStatements.push(`    float ${varName}_X = (${src}).x;`);
          fragmentStatements.push(`    float ${varName}_Y = (${src}).y;`);
          if (node.outputs.x) {
            portVarMap.set(node.outputs.x.id, `${varName}_X`);
            portTypeMap.set(node.outputs.x.id, "float");
          }
          if (node.outputs.y) {
            portVarMap.set(node.outputs.y.id, `${varName}_Y`);
            portTypeMap.set(node.outputs.y.id, "float");
          }
          break;
        }
        case "SplitVec3": {
          const src = args[0] || "vec3(0.0)";
          fragmentStatements.push(`    float ${varName}_X = (${src}).x;`);
          fragmentStatements.push(`    float ${varName}_Y = (${src}).y;`);
          fragmentStatements.push(`    float ${varName}_Z = (${src}).z;`);
          if (node.outputs.x) {
            portVarMap.set(node.outputs.x.id, `${varName}_X`);
            portTypeMap.set(node.outputs.x.id, "float");
          }
          if (node.outputs.y) {
            portVarMap.set(node.outputs.y.id, `${varName}_Y`);
            portTypeMap.set(node.outputs.y.id, "float");
          }
          if (node.outputs.z) {
            portVarMap.set(node.outputs.z.id, `${varName}_Z`);
            portTypeMap.set(node.outputs.z.id, "float");
          }
          break;
        }
        case "SplitVec4": {
          const src = args[0] || "vec4(0.0)";
          fragmentStatements.push(`    float ${varName}_X = (${src}).x;`);
          fragmentStatements.push(`    float ${varName}_Y = (${src}).y;`);
          fragmentStatements.push(`    float ${varName}_Z = (${src}).z;`);
          fragmentStatements.push(`    float ${varName}_W = (${src}).w;`);
          if (node.outputs.x) {
            portVarMap.set(node.outputs.x.id, `${varName}_X`);
            portTypeMap.set(node.outputs.x.id, "float");
          }
          if (node.outputs.y) {
            portVarMap.set(node.outputs.y.id, `${varName}_Y`);
            portTypeMap.set(node.outputs.y.id, "float");
          }
          if (node.outputs.z) {
            portVarMap.set(node.outputs.z.id, `${varName}_Z`);
            portTypeMap.set(node.outputs.z.id, "float");
          }
          if (node.outputs.w) {
            portVarMap.set(node.outputs.w.id, `${varName}_W`);
            portTypeMap.set(node.outputs.w.id, "float");
          }
          break;
        }

        // Attributes
        case "UV": {
          fragmentStatements.push(`    vec2 ${varName} = v_uv;`);
          if (node.outputs.value) {
            portVarMap.set(node.outputs.value.id, varName);
            portTypeMap.set(node.outputs.value.id, "vec2");
          }
          break;
        }
        case "VertexColor": {
          fragmentStatements.push(`    vec4 ${varName} = vec4(1.0);`);
          if (node.outputs.value) {
            portVarMap.set(node.outputs.value.id, varName);
            portTypeMap.set(node.outputs.value.id, "vec4");
          }
          break;
        }
        case "positionGeometry":
        case "positionLocal":
        case "positionWorld": {
          fragmentStatements.push(`    vec3 ${varName} = v_position;`);
          if (node.outputs.value) {
            portVarMap.set(node.outputs.value.id, varName);
            portTypeMap.set(node.outputs.value.id, "vec3");
          }
          break;
        }
        case "normalGeometry":
        case "normalLocal":
        case "normalWorld": {
          fragmentStatements.push(`    vec3 ${varName} = v_normal;`);
          if (node.outputs.value) {
            portVarMap.set(node.outputs.value.id, varName);
            portTypeMap.set(node.outputs.value.id, "vec3");
          }
          break;
        }

        // Uniforms
        case "TimeUniform": {
          fragmentStatements.push(`    float ${varName} = u_time;`);
          if (node.outputs.value) {
            portVarMap.set(node.outputs.value.id, varName);
            portTypeMap.set(node.outputs.value.id, "float");
          }
          break;
        }
        case "FloatUniform": {
          const uName = `u_${varName}`;
          const val = (node as any)._value?.value ?? 0;
          customUniformDecls.push(`uniform float ${uName};`);
          uniforms[uName] = { name: uName, type: "float", value: val };
          fragmentStatements.push(`    float ${varName} = ${uName};`);
          if (node.outputs.value) {
            portVarMap.set(node.outputs.value.id, varName);
            portTypeMap.set(node.outputs.value.id, "float");
          }
          break;
        }
        case "Vec2Uniform": {
          const uName = `u_${varName}`;
          const v = (node as any)._value || { x: 0, y: 0 };
          customUniformDecls.push(`uniform vec2 ${uName};`);
          uniforms[uName] = { name: uName, type: "vec2", value: [v.x, v.y] };
          fragmentStatements.push(`    vec2 ${varName} = ${uName};`);
          if (node.outputs.value) {
            portVarMap.set(node.outputs.value.id, varName);
            portTypeMap.set(node.outputs.value.id, "vec2");
          }
          break;
        }
        case "Vec3Uniform": {
          const uName = `u_${varName}`;
          const v = (node as any)._value || { x: 0, y: 0, z: 0 };
          customUniformDecls.push(`uniform vec3 ${uName};`);
          uniforms[uName] = { name: uName, type: "vec3", value: [v.x, v.y, v.z] };
          fragmentStatements.push(`    vec3 ${varName} = ${uName};`);
          if (node.outputs.value) {
            portVarMap.set(node.outputs.value.id, varName);
            portTypeMap.set(node.outputs.value.id, "vec3");
          }
          break;
        }
        case "TextureUniform": {
          const uSampler = `u_sampler_${varName}`;
          samplerDecls.push(`uniform sampler2D ${uSampler};`);
          const uvArg = args[0] || "v_uv";
          uniforms[uSampler] = {
            name: uSampler,
            type: "sampler2D",
            value: (node as any)._value?.value || "/uv_grid.jpg",
          };
          fragmentStatements.push(`    vec4 ${varName} = texture(${uSampler}, ${uvArg});`);
          if (node.outputs.value) {
            portVarMap.set(node.outputs.value.id, varName);
            portTypeMap.set(node.outputs.value.id, "vec4");
          }
          break;
        }

        // Math Operations
        case "Add":
        case "Sub":
        case "Mul":
        case "Div": {
          const op = nodeType === "Add" ? "+" : nodeType === "Sub" ? "-" : nodeType === "Mul" ? "*" : "/";
          const a = args[0] || (nodeType === "Mul" || nodeType === "Div" ? "1.0" : "0.0");
          const b = args[1] || (nodeType === "Mul" || nodeType === "Div" ? "1.0" : "0.0");
          const typeA = argTypes[0] || "float";
          const typeB = argTypes[1] || "float";
          const outType = promoteType(typeA, typeB);
          fragmentStatements.push(`    ${outType} ${varName} = (${a}) ${op} (${b});`);
          if (node.outputs.output) {
            portVarMap.set(node.outputs.output.id, varName);
            portTypeMap.set(node.outputs.output.id, outType);
          }
          break;
        }
        case "Sin":
        case "Cos":
        case "Abs":
        case "Floor":
        case "Ceil":
        case "Fract":
        case "Sqrt": {
          const fn = nodeType.toLowerCase();
          const a = args[0] || "0.0";
          const outType = argTypes[0] || "float";
          fragmentStatements.push(`    ${outType} ${varName} = ${fn}(${a});`);
          if (node.outputs.output) {
            portVarMap.set(node.outputs.output.id, varName);
            portTypeMap.set(node.outputs.output.id, outType);
          }
          break;
        }
        case "Mix": {
          const a = args[0] || "0.0";
          const b = args[1] || "1.0";
          const t = args[2] || "0.5";
          const outType = promoteType(argTypes[0] || "float", argTypes[1] || "float");
          fragmentStatements.push(`    ${outType} ${varName} = mix(${a}, ${b}, ${t});`);
          if (node.outputs.output) {
            portVarMap.set(node.outputs.output.id, varName);
            portTypeMap.set(node.outputs.output.id, outType);
          }
          break;
        }
        case "Clamp": {
          const x = args[0] || "0.0";
          const min = args[1] || "0.0";
          const max = args[2] || "1.0";
          const outType = argTypes[0] || "float";
          fragmentStatements.push(`    ${outType} ${varName} = clamp(${x}, ${min}, ${max});`);
          if (node.outputs.output) {
            portVarMap.set(node.outputs.output.id, varName);
            portTypeMap.set(node.outputs.output.id, outType);
          }
          break;
        }
        case "Dot": {
          const a = args[0] || "vec3(0.0)";
          const b = args[1] || "vec3(0.0)";
          fragmentStatements.push(`    float ${varName} = dot(${a}, ${b});`);
          if (node.outputs.output) {
            portVarMap.set(node.outputs.output.id, varName);
            portTypeMap.set(node.outputs.output.id, "float");
          }
          break;
        }
        case "Cross": {
          const a = args[0] || "vec3(1.0, 0.0, 0.0)";
          const b = args[1] || "vec3(0.0, 1.0, 0.0)";
          fragmentStatements.push(`    vec3 ${varName} = cross(${a}, ${b});`);
          if (node.outputs.output) {
            portVarMap.set(node.outputs.output.id, varName);
            portTypeMap.set(node.outputs.output.id, "vec3");
          }
          break;
        }
        case "Normalize": {
          const a = args[0] || "vec3(1.0)";
          const outType = argTypes[0] || "vec3";
          fragmentStatements.push(`    ${outType} ${varName} = normalize(${a});`);
          if (node.outputs.output) {
            portVarMap.set(node.outputs.output.id, varName);
            portTypeMap.set(node.outputs.output.id, outType);
          }
          break;
        }
        case "Length": {
          const a = args[0] || "vec3(0.0)";
          fragmentStatements.push(`    float ${varName} = length(${a});`);
          if (node.outputs.output) {
            portVarMap.set(node.outputs.output.id, varName);
            portTypeMap.set(node.outputs.output.id, "float");
          }
          break;
        }
        case "Distance": {
          const a = args[0] || "vec3(0.0)";
          const b = args[1] || "vec3(0.0)";
          fragmentStatements.push(`    float ${varName} = distance(${a}, ${b});`);
          if (node.outputs.output) {
            portVarMap.set(node.outputs.output.id, varName);
            portTypeMap.set(node.outputs.output.id, "float");
          }
          break;
        }
        case "Pow": {
          const x = args[0] || "1.0";
          const y = args[1] || "2.0";
          const outType = argTypes[0] || "float";
          fragmentStatements.push(`    ${outType} ${varName} = pow(${x}, ${y});`);
          if (node.outputs.output) {
            portVarMap.set(node.outputs.output.id, varName);
            portTypeMap.set(node.outputs.output.id, outType);
          }
          break;
        }
        case "Pow2": {
          const x = args[0] || "1.0";
          const outType = argTypes[0] || "float";
          fragmentStatements.push(`    ${outType} ${varName} = (${x}) * (${x});`);
          if (node.outputs.output) {
            portVarMap.set(node.outputs.output.id, varName);
            portTypeMap.set(node.outputs.output.id, outType);
          }
          break;
        }
        case "Varying": {
          const a = args[0] || "0.0";
          const outType = argTypes[0] || "float";
          fragmentStatements.push(`    ${outType} ${varName} = ${a};`);
          if (node.outputs.varying) {
            portVarMap.set(node.outputs.varying.id, varName);
            portTypeMap.set(node.outputs.varying.id, outType);
          }
          break;
        }
        case "MeshStandardMaterialNode":
        case "GLSLOutputNode": {
          const col = args[0] || "vec4(1.0, 0.0, 0.0, 1.0)";
          const colType = argTypes[0] || "vec4";
          fragmentStatements.push(`    // Output assignment`);
          fragmentStatements.push(`    fragColor = ${this.ensureVec4(col, colType)};`);
          break;
        }
        default: {
          // Fallback for custom or unrecognized node
          const firstArg = args[0] || "0.0";
          const outType = argTypes[0] || "float";
          fragmentStatements.push(`    ${outType} ${varName} = ${firstArg};`);
          const firstOutput = Object.values(node.outputs)[0];
          if (firstOutput) {
            portVarMap.set(firstOutput.id, varName);
            portTypeMap.set(firstOutput.id, outType);
          }
          break;
        }
      }
    });

    // Replace auto_type placeholders with valid GLSL types through post-processing
    const resolvedStatements = this.resolveTypes(fragmentStatements);

    // Build the vertex shader
    const vertexShader = `#version 300 es
precision highp float;

in vec3 a_position;
in vec3 a_normal;
in vec2 a_uv;

uniform mat4 u_modelViewMatrix;
uniform mat4 u_projectionMatrix;
uniform mat3 u_normalMatrix;
uniform float u_time;

out vec2 v_uv;
out vec3 v_normal;
out vec3 v_position;

void main() {
    v_uv = a_uv;
    v_normal = normalize(u_normalMatrix * a_normal);
    v_position = a_position;
    gl_Position = u_projectionMatrix * u_modelViewMatrix * vec4(a_position, 1.0);
}
`;

    // Build the fragment shader
    const customDecls = [...new Set([...customUniformDecls, ...samplerDecls])].join("\n");
    const fragmentShader = `#version 300 es
precision highp float;
precision highp int;

in vec2 v_uv;
in vec3 v_normal;
in vec3 v_position;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
${customDecls ? customDecls + "\n" : ""}
out vec4 fragColor;

void main() {
${resolvedStatements.join("\n")}
}
`;

    return {
      backend: "GLSL",
      success: errors.length === 0,
      vertexShader,
      fragmentShader,
      uniforms,
      errors,
      warnings,
    };
  }

  private findTerminalNode(nodes: Node[]): Node | null {
    // Find a node that has connected inputs but no connected outputs
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const hasConnectedInput = Object.values(node.inputs).some((inp) => inp.connection);
      const hasConnectedOutput = Object.values(node.outputs).some(
        (out) => out.connections && out.connections.length > 0
      );
      if (hasConnectedInput && !hasConnectedOutput) {
        return node;
      }
    }
    return nodes[nodes.length - 1] || null;
  }

  private ensureVec4(expr: string, inferredType: "float" | "vec2" | "vec3" | "vec4" = "float"): string {
    const trimmed = expr.trim();
    if (trimmed.startsWith("vec4(") || trimmed.includes(".rgba")) {
      return trimmed;
    }
    if (inferredType === "vec4") {
      return trimmed;
    }
    if (inferredType === "vec3" || trimmed.startsWith("vec3(")) {
      return `vec4(${trimmed}, 1.0)`;
    }
    if (inferredType === "vec2" || trimmed.startsWith("vec2(")) {
      return `vec4(${trimmed}, 0.0, 1.0)`;
    }
    // Generic fallback: float
    return `vec4(${trimmed}, ${trimmed}, ${trimmed}, 1.0)`;
  }

  private resolveTypes(statements: string[]): string[] {
    // Replaces auto_type with vec4, vec3, vec2, or float depending on RHS inspection
    return statements.map((stmt) => {
      if (!stmt.includes("auto_type")) return stmt;
      const rhs = stmt.split("=")[1] || "";
      if (rhs.includes("vec4") || rhs.includes("fragColor")) {
        return stmt.replace("auto_type", "vec4");
      } else if (rhs.includes("vec3") || rhs.includes("cross") || rhs.includes("v_position") || rhs.includes("v_normal")) {
        return stmt.replace("auto_type", "vec3");
      } else if (rhs.includes("vec2") || rhs.includes("v_uv")) {
        return stmt.replace("auto_type", "vec2");
      } else if (rhs.includes("dot") || rhs.includes("length") || rhs.includes("distance") || rhs.includes("u_time")) {
        return stmt.replace("auto_type", "float");
      }
      // Default to vec4 or float
      return stmt.replace("auto_type", "vec4");
    });
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    let cleanHex = hex.replace("#", "");
    if (cleanHex.length === 3) {
      cleanHex = cleanHex
        .split("")
        .map((c) => c + c)
        .join("");
    }
    const num = parseInt(cleanHex, 16);
    return {
      r: ((num >> 16) & 255) / 255,
      g: ((num >> 8) & 255) / 255,
      b: (num & 255) / 255,
    };
  }

  private getDefaultShader(): CompilationResult {
    const vertexShader = `#version 300 es
precision highp float;

in vec3 a_position;
in vec3 a_normal;
in vec2 a_uv;

uniform mat4 u_modelViewMatrix;
uniform mat4 u_projectionMatrix;
uniform mat3 u_normalMatrix;
uniform float u_time;

out vec2 v_uv;
out vec3 v_normal;
out vec3 v_position;

void main() {
    v_uv = a_uv;
    v_normal = normalize(u_normalMatrix * a_normal);
    v_position = a_position;
    gl_Position = u_projectionMatrix * u_modelViewMatrix * vec4(a_position, 1.0);
}
`;

    const fragmentShader = `#version 300 es
precision highp float;

in vec2 v_uv;
in vec3 v_normal;
in vec3 v_position;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;

out vec4 fragColor;

void main() {
    // Default gradient based on normal and time
    vec3 col = 0.5 + 0.5 * cos(u_time + v_normal.xyx + vec3(0.0, 2.0, 4.0));
    fragColor = vec4(col, 1.0);
}
`;

    return {
      backend: "GLSL",
      success: true,
      vertexShader,
      fragmentShader,
      uniforms: {
        u_time: { name: "u_time", type: "float", value: 0 },
        u_resolution: { name: "u_resolution", type: "vec2", value: [800, 600] },
        u_mouse: { name: "u_mouse", type: "vec2", value: [0, 0] },
      },
      errors: [],
      warnings: [],
    };
  }
}

export const glslBackend = new GLSLBackend();
