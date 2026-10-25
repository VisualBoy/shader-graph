import { Node } from "../nodl-core";
import { MeshStandardMaterialNode } from "../nodes/MaterialNodes";
import { Float, Vec2, Vec3, Vec4 } from "../nodes/ConstantNodes";
import {
  Add,
  Sub,
  Mul,
  Div,
  Sin,
  Cos,
  Mix,
  Clamp,
  Dot,
  Cross,
  Normalize,
  Length,
  Fract,
} from "../nodes/MathNodes";
import { UV } from "../nodes/AttributeNodes";
import { TimeUniform, FloatUniform, Vec2Uniform, Vec3Uniform, TextureUniform } from "../nodes/UniformNodes";

export interface ParsedConnection {
  fromNode: Node;
  fromPort: string;
  toNode: Node;
  toPort: string;
}

export interface ParsedShaderGraph {
  nodesWithPositions: [Node, { x: number; y: number }][];
  connections: ParsedConnection[];
  errors: string[];
}

export class GLSLParser {
  public static parse(glslSource: string): ParsedShaderGraph {
    const errors: string[] = [];
    const nodesWithPositions: [Node, { x: number; y: number }][] = [];
    const connections: ParsedConnection[] = [];

    // Map variable names to source node and output port
    const symbolMap = new Map<string, { node: Node; portName: string }>();

    // Clean comments
    const cleanSource = glslSource
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    // Track layout levels
    let inputY = -300;
    let mathX = -200;
    let mathY = -300;

    // Helper to register an input node
    const addInputNode = (node: Node, portName: string, sym: string, x = -600): Node => {
      nodesWithPositions.push([node, { x, y: inputY }]);
      inputY += 160;
      symbolMap.set(sym, { node, portName });
      return node;
    };

    // Helper to register an intermediate node
    const addMathNode = (node: Node, portName: string, sym?: string): Node => {
      nodesWithPositions.push([node, { x: mathX, y: mathY }]);
      mathY += 180;
      if (mathY > 400) {
        mathY = -300;
        mathX += 280;
      }
      if (sym) {
        symbolMap.set(sym, { node, portName });
      }
      return node;
    };

    // Extract uniform declarations
    const uniformRegex = /uniform\s+([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+)\s*;/g;
    let match: RegExpExecArray | null;
    while ((match = uniformRegex.exec(cleanSource)) !== null) {
      const type = match[1];
      const name = match[2];

      if (name === "u_time" || name === "time") {
        const timeNode = new TimeUniform();
        addInputNode(timeNode, "value", name);
      } else if (type === "float") {
        const fNode = new FloatUniform();
        addInputNode(fNode, "value", name);
      } else if (type === "vec2") {
        const vNode = new Vec2Uniform();
        addInputNode(vNode, "value", name);
      } else if (type === "vec3") {
        const vNode = new Vec3Uniform();
        addInputNode(vNode, "value", name);
      } else if (type === "sampler2D") {
        const texNode = new TextureUniform();
        addInputNode(texNode, "value", name);
      }
    }

    // Always ensure a UV node is available if referenced
    let uvNode: UV | null = null;
    const ensureUV = (): { node: Node; portName: string } => {
      if (!uvNode) {
        uvNode = new UV();
        addInputNode(uvNode, "value", "v_uv");
        symbolMap.set("uv", { node: uvNode, portName: "value" });
      }
      return { node: uvNode, portName: "value" };
    };

    if (cleanSource.includes("v_uv") || cleanSource.includes("uv")) {
      ensureUV();
    }

    if (cleanSource.includes("u_time") && !symbolMap.has("u_time")) {
      const timeNode = new TimeUniform();
      addInputNode(timeNode, "value", "u_time");
      symbolMap.set("time", { node: timeNode, portName: "value" });
    }

    // Extract main() body
    const mainMatch = /void\s+main\s*\(\s*\)\s*\{([\s\S]*?)\}/.exec(cleanSource);
    const body = mainMatch ? mainMatch[1] : cleanSource;

    // Parse statements inside main()
    const statements = body
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    let outputTargetNode: Node | null = null;
    let finalColorVar: string | null = null;

    statements.forEach((stmt) => {
      // Check for assignment to fragColor / gl_FragColor
      const fragMatch = /(fragColor|gl_FragColor)\s*=\s*(.+)/.exec(stmt);
      if (fragMatch) {
        finalColorVar = fragMatch[2].trim();
        return;
      }

      // Check for variable declaration with assignment
      // e.g. vec4 col = mix(a, b, t) or float x = sin(t)
      const declMatch = /([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+)\s*=\s*(.+)/.exec(stmt);
      if (declMatch) {
        const type = declMatch[1];
        const varName = declMatch[2];
        const expr = declMatch[3].trim();
        this.parseExpression(expr, type, varName, symbolMap, addMathNode, connections);
        return;
      }

      // Simple reassignment
      const reassignMatch = /([a-zA-Z0-9_]+)\s*=\s*(.+)/.exec(stmt);
      if (reassignMatch) {
        const varName = reassignMatch[1];
        const expr = reassignMatch[2].trim();
        this.parseExpression(expr, "vec4", varName, symbolMap, addMathNode, connections);
      }
    });

    // Create the material output sink node
    outputTargetNode = new MeshStandardMaterialNode();
    nodesWithPositions.push([outputTargetNode, { x: mathX + 320, y: 0 }]);

    // Connect final color if found
    if (finalColorVar) {
      this.wireExpressionToInput(
        finalColorVar,
        outputTargetNode,
        "colorNode",
        symbolMap,
        addMathNode,
        connections
      );
    } else {
      // Default connection to last created node if available
      const lastCreated = Array.from(symbolMap.values()).pop();
      if (lastCreated) {
        connections.push({
          fromNode: lastCreated.node,
          fromPort: lastCreated.portName,
          toNode: outputTargetNode,
          toPort: "colorNode",
        });
      }
    }

    return {
      nodesWithPositions,
      connections,
      errors,
    };
  }

  private static parseExpression(
    expr: string,
    targetType: string,
    varName: string,
    symbolMap: Map<string, { node: Node; portName: string }>,
    addMathNode: (node: Node, portName: string, sym?: string) => Node,
    connections: ParsedConnection[]
  ) {
    const cleanExpr = expr.trim();

    // 1. Function calls: mix(a, b, t)
    const mixMatch = /^mix\s*\((.*)\)$/.exec(cleanExpr);
    if (mixMatch) {
      const args = this.splitArgs(mixMatch[1]);
      const node = new Mix();
      addMathNode(node, "output", varName);
      if (args[0]) this.wireExpressionToInput(args[0], node, "x", symbolMap, addMathNode, connections);
      if (args[1]) this.wireExpressionToInput(args[1], node, "y", symbolMap, addMathNode, connections);
      if (args[2]) this.wireExpressionToInput(args[2], node, "a", symbolMap, addMathNode, connections);
      return;
    }

    // 2. Trigonometry: sin, cos
    const sinMatch = /^sin\s*\((.*)\)$/.exec(cleanExpr);
    if (sinMatch) {
      const node = new Sin();
      addMathNode(node, "output", varName);
      this.wireExpressionToInput(sinMatch[1], node, "a", symbolMap, addMathNode, connections);
      return;
    }

    const cosMatch = /^cos\s*\((.*)\)$/.exec(cleanExpr);
    if (cosMatch) {
      const node = new Cos();
      addMathNode(node, "output", varName);
      this.wireExpressionToInput(cosMatch[1], node, "a", symbolMap, addMathNode, connections);
      return;
    }

    // 3. Dot / Cross / Normalize / Length
    const dotMatch = /^dot\s*\((.*)\)$/.exec(cleanExpr);
    if (dotMatch) {
      const args = this.splitArgs(dotMatch[1]);
      const node = new Dot();
      addMathNode(node, "output", varName);
      if (args[0]) this.wireExpressionToInput(args[0], node, "x", symbolMap, addMathNode, connections);
      if (args[1]) this.wireExpressionToInput(args[1], node, "y", symbolMap, addMathNode, connections);
      return;
    }

    const crossMatch = /^cross\s*\((.*)\)$/.exec(cleanExpr);
    if (crossMatch) {
      const args = this.splitArgs(crossMatch[1]);
      const node = new Cross();
      addMathNode(node, "output", varName);
      if (args[0]) this.wireExpressionToInput(args[0], node, "x", symbolMap, addMathNode, connections);
      if (args[1]) this.wireExpressionToInput(args[1], node, "y", symbolMap, addMathNode, connections);
      return;
    }

    const normMatch = /^normalize\s*\((.*)\)$/.exec(cleanExpr);
    if (normMatch) {
      const node = new Normalize();
      addMathNode(node, "output", varName);
      this.wireExpressionToInput(normMatch[1], node, "x", symbolMap, addMathNode, connections);
      return;
    }

    const lenMatch = /^length\s*\((.*)\)$/.exec(cleanExpr);
    if (lenMatch) {
      const node = new Length();
      addMathNode(node, "output", varName);
      this.wireExpressionToInput(lenMatch[1], node, "a", symbolMap, addMathNode, connections);
      return;
    }

    const clampMatch = /^clamp\s*\((.*)\)$/.exec(cleanExpr);
    if (clampMatch) {
      const args = this.splitArgs(clampMatch[1]);
      const node = new Clamp();
      addMathNode(node, "output", varName);
      if (args[0]) this.wireExpressionToInput(args[0], node, "x", symbolMap, addMathNode, connections);
      if (args[1]) this.wireExpressionToInput(args[1], node, "min", symbolMap, addMathNode, connections);
      if (args[2]) this.wireExpressionToInput(args[2], node, "max", symbolMap, addMathNode, connections);
      return;
    }

    const fractMatch = /^fract\s*\((.*)\)$/.exec(cleanExpr);
    if (fractMatch) {
      const node = new Fract();
      addMathNode(node, "output", varName);
      this.wireExpressionToInput(fractMatch[1], node, "a", symbolMap, addMathNode, connections);
      return;
    }

    // 4. Binary operations (+, -, *, /)
    const binOp = this.findTopLevelBinaryOp(cleanExpr);
    if (binOp) {
      let node: Node;
      if (binOp.op === "+") node = new Add();
      else if (binOp.op === "-") node = new Sub();
      else if (binOp.op === "*") node = new Mul();
      else node = new Div();

      addMathNode(node, "output", varName);
      this.wireExpressionToInput(binOp.left, node, "a", symbolMap, addMathNode, connections);
      this.wireExpressionToInput(binOp.right, node, "b", symbolMap, addMathNode, connections);
      return;
    }

    // 5. Vector constructors: vec2, vec3, vec4
    const vec4Match = /^vec4\s*\((.*)\)$/.exec(cleanExpr);
    if (vec4Match) {
      const args = this.splitArgs(vec4Match[1]);
      const node = new Vec4();
      addMathNode(node, "value", varName);
      if (args[0]) this.wireExpressionToInput(args[0], node, "a", symbolMap, addMathNode, connections);
      if (args[1]) this.wireExpressionToInput(args[1], node, "b", symbolMap, addMathNode, connections);
      if (args[2]) this.wireExpressionToInput(args[2], node, "c", symbolMap, addMathNode, connections);
      if (args[3]) this.wireExpressionToInput(args[3], node, "d", symbolMap, addMathNode, connections);
      return;
    }

    const vec3Match = /^vec3\s*\((.*)\)$/.exec(cleanExpr);
    if (vec3Match) {
      const args = this.splitArgs(vec3Match[1]);
      const node = new Vec3();
      addMathNode(node, "value", varName);
      if (args[0]) this.wireExpressionToInput(args[0], node, "a", symbolMap, addMathNode, connections);
      if (args[1]) this.wireExpressionToInput(args[1], node, "b", symbolMap, addMathNode, connections);
      if (args[2]) this.wireExpressionToInput(args[2], node, "c", symbolMap, addMathNode, connections);
      return;
    }

    const vec2Match = /^vec2\s*\((.*)\)$/.exec(cleanExpr);
    if (vec2Match) {
      const args = this.splitArgs(vec2Match[1]);
      const node = new Vec2();
      addMathNode(node, "value", varName);
      if (args[0]) this.wireExpressionToInput(args[0], node, "a", symbolMap, addMathNode, connections);
      if (args[1]) this.wireExpressionToInput(args[1], node, "b", symbolMap, addMathNode, connections);
      return;
    }

    // 6. Direct variable alias or constant
    const existing = symbolMap.get(cleanExpr);
    if (existing) {
      symbolMap.set(varName, existing);
    } else {
      // Numeric float constant
      const num = parseFloat(cleanExpr);
      if (!isNaN(num)) {
        const fNode = new Float();
        fNode.inputs.a.next(() => num);
        addMathNode(fNode, "value", varName);
      }
    }
  }

  private static wireExpressionToInput(
    expr: string,
    targetNode: Node,
    inputPortName: string,
    symbolMap: Map<string, { node: Node; portName: string }>,
    addMathNode: (node: Node, portName: string, sym?: string) => Node,
    connections: ParsedConnection[]
  ) {
    const clean = expr.trim();

    // Check if directly matches a known variable symbol
    if (symbolMap.has(clean)) {
      const source = symbolMap.get(clean)!;
      connections.push({
        fromNode: source.node,
        fromPort: source.portName,
        toNode: targetNode,
        toPort: inputPortName,
      });
      return;
    }

    // Number literal
    const num = parseFloat(clean);
    if (!isNaN(num) && clean.match(/^-?[0-9.]+f?$/)) {
      const fNode = new Float();
      fNode.inputs.a.next(() => num);
      addMathNode(fNode, "value");
      connections.push({
        fromNode: fNode,
        fromPort: "value",
        toNode: targetNode,
        toPort: inputPortName,
      });
      return;
    }

    // Sub-expression: create inline variable name and parse
    const inlineVar = `tmp_${Math.random().toString(36).substring(2, 7)}`;
    this.parseExpression(clean, "vec4", inlineVar, symbolMap, addMathNode, connections);
    const resolved = symbolMap.get(inlineVar);
    if (resolved) {
      connections.push({
        fromNode: resolved.node,
        fromPort: resolved.portName,
        toNode: targetNode,
        toPort: inputPortName,
      });
    }
  }

  private static splitArgs(argsStr: string): string[] {
    const args: string[] = [];
    let current = "";
    let parenDepth = 0;

    for (let i = 0; i < argsStr.length; i++) {
      const c = argsStr[i];
      if (c === "(") parenDepth++;
      else if (c === ")") parenDepth--;

      if (c === "," && parenDepth === 0) {
        args.push(current.trim());
        current = "";
      } else {
        current += c;
      }
    }
    if (current.trim().length > 0) {
      args.push(current.trim());
    }
    return args;
  }

  private static findTopLevelBinaryOp(expr: string): { op: string; left: string; right: string } | null {
    let parenDepth = 0;
    // Scan for lowest precedence (+, -) then (*, /)
    const ops = [["+", "-"], ["*", "/"]];

    for (const opGroup of ops) {
      parenDepth = 0;
      for (let i = expr.length - 1; i >= 0; i--) {
        const c = expr[i];
        if (c === ")") parenDepth++;
        else if (c === "(") parenDepth--;
        else if (parenDepth === 0 && opGroup.includes(c)) {
          // Avoid unary minus
          if (c === "-" && (i === 0 || "*/+-([,".includes(expr[i - 1].trim()))) {
            continue;
          }
          return {
            op: c,
            left: expr.substring(0, i).trim(),
            right: expr.substring(i + 1).trim(),
          };
        }
      }
    }
    return null;
  }

  // Pre-built sample shaders for user convenience in the Import modal
  public static readonly PRESETS: Record<string, string> = {
    "Color Wave (Normal & Time)": `#version 300 es
precision highp float;

in vec2 v_uv;
in vec3 v_normal;
uniform float u_time;
out vec4 fragColor;

void main() {
    float wave = sin(u_time * 2.0 + v_uv.x * 10.0);
    vec4 colA = vec4(0.12, 0.38, 1.0, 1.0);
    vec4 colB = vec4(0.95, 0.2, 0.45, 1.0);
    vec4 mixedColor = mix(colA, colB, wave * 0.5 + 0.5);
    fragColor = mixedColor;
}`,
    "Radial Gradient": `#version 300 es
precision highp float;

in vec2 v_uv;
uniform float u_time;
out vec4 fragColor;

void main() {
    vec2 center = vec2(0.5, 0.5);
    vec2 delta = v_uv - center;
    float dist = length(delta);
    float glow = clamp(1.0 - dist * 2.0, 0.0, 1.0);
    vec4 innerColor = vec4(1.0, 0.85, 0.2, 1.0);
    vec4 outerColor = vec4(0.05, 0.05, 0.15, 1.0);
    fragColor = mix(outerColor, innerColor, glow);
}`,
    "Animated Normal Visualizer": `#version 300 es
precision highp float;

in vec3 v_normal;
uniform float u_time;
out vec4 fragColor;

void main() {
    vec3 n = normalize(v_normal);
    vec3 animated = n * 0.5 + 0.5;
    fragColor = vec4(animated, 1.0);
}`,
  };
}
