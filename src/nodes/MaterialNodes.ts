import { Input, schema, Node } from "../nodl-core";
import { z } from "zod";

import { normalLocal, positionLocal, vec4 } from "three/tsl";

export class MeshStandardMaterialNode extends Node {
  name = "MeshStandardMaterialNode";
  inputs = {
    colorNode: new Input({
      name: "colorNode",
      type: schema(z.any()),
      defaultValue: () => vec4(1, 0, 0, 1)
    }),
    positionNode: new Input({
      name: "positionNode",
      type: schema(z.any()),
      defaultValue: () => positionLocal
    }),
    normalNode: new Input({
      name: "normalNode",
      type: schema(z.any()),
      defaultValue: () => normalLocal
    })
  };

  outputs = {};

  public code = (args: string[]) => {
    const argsString = !this.inputs.colorNode.connected
      ? `vec4(1, 0, 0, 1)`
      : args.join(", ");
    return {
      code: `return ${argsString}`,
      dependencies: ["vec4"],
    };
  };
}

export class GLSLOutputNode extends Node {
  name = "GLSLOutputNode";
  inputs = {
    colorNode: new Input({
      name: "fragColor",
      type: schema(z.any()),
      defaultValue: () => vec4(0.2, 0.6, 1.0, 1.0),
    }),
    positionNode: new Input({
      name: "positionOffset",
      type: schema(z.any()),
      defaultValue: () => positionLocal,
    }),
    normalNode: new Input({
      name: "normal",
      type: schema(z.any()),
      defaultValue: () => normalLocal,
    }),
  };

  outputs = {};

  public code = (args: string[]) => {
    const argsString = !this.inputs.colorNode.connected ? `vec4(0.2, 0.6, 1.0, 1.0)` : args.join(", ");
    return {
      code: `return ${argsString}`,
      dependencies: ["vec4"],
    };
  };
}

export const MaterialNodes = { MeshStandardMaterialNode, GLSLOutputNode };

