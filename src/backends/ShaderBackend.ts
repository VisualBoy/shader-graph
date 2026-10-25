import { Node } from "../nodl-core";
import { EditorEventEmitter } from "../nodes/utils";

export type ShaderBackendType = "GLSL" | "TSL";

export interface UniformDescriptor {
  name: string;
  type: "float" | "vec2" | "vec3" | "vec4" | "sampler2D" | "int";
  value: any;
}

export interface CompilationResult {
  backend: ShaderBackendType;
  success: boolean;
  vertexShader: string;
  fragmentShader: string;
  tslCode?: string;
  uniforms: Record<string, UniformDescriptor>;
  errors: string[];
  warnings: string[];
}

export interface IShaderBackend {
  readonly type: ShaderBackendType;
  compile(nodes: Node[]): CompilationResult;
}

class BackendManager {
  private _activeBackendType: ShaderBackendType = "GLSL";
  private _lastResult: CompilationResult | null = null;

  public get activeBackendType(): ShaderBackendType {
    return this._activeBackendType;
  }

  public setBackend(type: ShaderBackendType) {
    if (this._activeBackendType === type) return;
    this._activeBackendType = type;
    EditorEventEmitter.emit("backendChanged", { backend: type });
    EditorEventEmitter.emit("forceRender");
  }

  public setLastResult(result: CompilationResult) {
    this._lastResult = result;
    EditorEventEmitter.emit("shaderCompiled", result);
  }

  public getLastResult(): CompilationResult | null {
    return this._lastResult;
  }
}

export const shaderBackendManager = new BackendManager();
