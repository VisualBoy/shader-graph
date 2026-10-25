import { Node, Input } from "../nodl-core";
import { CompilationResult, IShaderBackend } from "./ShaderBackend";
import { createVarNameForNode } from "../nodes/utils";

type TreeNodeType = {
  node: Node;
  parents: TreeNodeType[];
};

type TreeType = {
  [key: string]: TreeNodeType;
};

export class TSLBackend implements IShaderBackend {
  public readonly type = "TSL" as const;

  public compile(nodes: Node[]): CompilationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const outputToNodeMap = new Map<string, Node>();
    const inputToNodeMap = new Map<string, Node>();

    nodes.forEach((node) => {
      Object.values(node.outputs).forEach((output) => {
        outputToNodeMap.set(output.id, node);
      });
      Object.values(node.inputs).forEach((input) => {
        inputToNodeMap.set(input.id, node);
      });
    });

    const materialNode = nodes.find(
      (n) => n.name === "MeshStandardMaterialNode" || n.constructor.name === "MeshStandardMaterialNode"
    );

    if (!materialNode) {
      return {
        backend: "TSL",
        success: true,
        vertexShader: "",
        fragmentShader: "",
        tslCode: `// No material node present in graph`,
        uniforms: {},
        errors: [],
        warnings: ["No MeshStandardMaterialNode found in the current graph."],
      };
    }

    const tree: TreeType = {
      [materialNode.id]: {
        node: materialNode,
        parents: [],
      },
    };

    const pushNodeToTree = (currentNode: Node, parentNode: TreeNodeType, traceInput?: string) => {
      const currentInputs: Input[] = traceInput
        ? Object.keys(currentNode.inputs)
            .filter((inputName) => inputName === traceInput)
            .map((name) => currentNode.inputs[name])
            .filter((input) => input !== null && input !== undefined)
        : Object.values(currentNode.inputs);

      currentInputs.forEach((currentInput) => {
        const connection = currentInput.connection;
        if (!connection) return;

        const output = connection.from;
        const sourceNode = outputToNodeMap.get(output.id);
        if (!sourceNode) return;

        const leaf: TreeNodeType = {
          node: sourceNode,
          parents: [],
        };
        parentNode.parents = [...parentNode.parents, leaf];
        pushNodeToTree(sourceNode, leaf);
      });
    };

    pushNodeToTree(materialNode, tree[materialNode.id], "colorNode");

    const traverseTree = (rootNode: TreeNodeType, cb: (child: TreeNodeType) => void) => {
      cb(rootNode);
      rootNode.parents.forEach((parent) => {
        traverseTree(parent, cb);
      });
    };

    const generatedCode: string[] = [];
    const imports = new Set<string>();

    traverseTree(tree[materialNode.id], (child) => {
      const node = child.node;
      const inputs = Object.values(node.inputs);
      const t = ["X", "Y", "Z", "W"];

      const args: string[] = [];
      for (let index = 0; index < inputs.length; index++) {
        const input = inputs[index];
        if (input.connection) {
          const id = input.connection.from.id;
          const sourceNode = outputToNodeMap.get(id);
          if (sourceNode) {
            const isSplitNode = sourceNode.name.includes("Split");
            const varName = createVarNameForNode(sourceNode);
            if (isSplitNode) {
              args.push(`${varName}_${t[index] || "X"}`);
            } else {
              args.push(varName);
            }
          }
        }
      }

      const code = node.code && node.code(args);
      if (code) {
        generatedCode.unshift(code.code.trim());
        code.dependencies.forEach((importName) => {
          imports.add(importName);
        });
      }
    });

    const importsString = Array.from(imports).join(", ");
    const importStatement = `import { ${importsString || "vec4"}, Fn } from "three/tsl";`;
    const uniqueStatements = [...new Set(generatedCode)].join("\n    ");
    const tslCode = `${importStatement}\n\nexport const shader = Fn(() => {\n    ${uniqueStatements}\n})();`;

    return {
      backend: "TSL",
      success: errors.length === 0,
      vertexShader: "",
      fragmentShader: "",
      tslCode,
      uniforms: {},
      errors,
      warnings,
    };
  }
}

export const tslBackend = new TSLBackend();
