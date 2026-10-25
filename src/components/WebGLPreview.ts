import { UniformDescriptor } from "../backends/ShaderBackend";

export type PreviewGeometryType = "sphere" | "cube" | "plane" | "quad";

interface MeshBuffers {
  vao: WebGLVertexArrayObject;
  positionBuffer: WebGLBuffer;
  normalBuffer: WebGLBuffer;
  uvBuffer: WebGLBuffer;
  indexBuffer?: WebGLBuffer;
  indexCount: number;
}

export class WebGLPreview {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private currentProgram: WebGLProgram | null = null;
  private currentGeometry: PreviewGeometryType = "sphere";
  private animationFrameId: number | null = null;
  private startTime: number = performance.now();
  private mouse = { x: 0, y: 0, isDragging: false, lastX: 0, lastY: 0 };
  private camera = {
    rotationX: 0.2,
    rotationY: -0.4,
    distance: 3.5,
    fov: 45,
  };
  private meshMap: Map<PreviewGeometryType, MeshBuffers> = new Map();
  private uniforms: Record<string, UniformDescriptor> = {};
  private textures: Map<string, WebGLTexture> = new Map();
  private defaultTexture: WebGLTexture | null = null;

  public onCompileStatus?: (status: { success: boolean; error?: string }) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", { antialias: true, alpha: true, depth: true });
    if (!gl) {
      throw new Error("WebGL 2.0 is not supported in this environment");
    }
    this.gl = gl;

    this.initGL();
    this.createDefaultTexture();
    this.initGeometries();
    this.setupInteractions();
    this.startRenderLoop();
  }

  private initGL() {
    const gl = this.gl;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearColor(0.07, 0.08, 0.11, 1.0);
  }

  private createDefaultTexture() {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // 2x2 checkerboard
    const pixels = new Uint8Array([
      200, 200, 200, 255,   80, 80, 80, 255,
       80, 80, 80, 255,   200, 200, 200, 255,
    ]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    this.defaultTexture = tex;
  }

  private initGeometries() {
    this.meshMap.set("sphere", this.createSphere(1.2, 40, 40));
    this.meshMap.set("cube", this.createCube(1.8));
    this.meshMap.set("plane", this.createPlane(2.5, 2.5, 20, 20));
    this.meshMap.set("quad", this.createQuad());
  }

  public setGeometry(type: PreviewGeometryType) {
    this.currentGeometry = type;
    if (type === "quad") {
      this.camera.distance = 2.0;
      this.camera.rotationX = 0;
      this.camera.rotationY = 0;
    } else if (this.camera.distance === 2.0 && type !== "quad") {
      this.camera.distance = 3.5;
    }
  }

  public getGeometry(): PreviewGeometryType {
    return this.currentGeometry;
  }

  public updateShaders(vertexSrc: string, fragmentSrc: string, uniforms?: Record<string, UniformDescriptor>) {
    if (uniforms) {
      this.uniforms = uniforms;
    }

    const gl = this.gl;
    const vertShader = gl.createShader(gl.VERTEX_SHADER);
    const fragShader = gl.createShader(gl.FRAGMENT_SHADER);

    if (!vertShader || !fragShader) {
      this.reportStatus(false, "Failed to allocate WebGL shader objects");
      return;
    }

    gl.shaderSource(vertShader, vertexSrc);
    gl.compileShader(vertShader);
    if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
      const err = gl.getShaderInfoLog(vertShader) || "Vertex Shader Compile Error";
      gl.deleteShader(vertShader);
      gl.deleteShader(fragShader);
      this.reportStatus(false, `[Vertex Shader Error] ${err}`);
      return;
    }

    gl.shaderSource(fragShader, fragmentSrc);
    gl.compileShader(fragShader);
    if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
      const err = gl.getShaderInfoLog(fragShader) || "Fragment Shader Compile Error";
      gl.deleteShader(vertShader);
      gl.deleteShader(fragShader);
      this.reportStatus(false, `[Fragment Shader Error] ${err}`);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertShader);
      gl.deleteShader(fragShader);
      this.reportStatus(false, "Failed to allocate WebGL program object");
      return;
    }

    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const err = gl.getProgramInfoLog(program) || "Shader Program Link Error";
      gl.deleteProgram(program);
      gl.deleteShader(vertShader);
      gl.deleteShader(fragShader);
      this.reportStatus(false, `[Link Error] ${err}`);
      return;
    }

    // Clean up old program
    if (this.currentProgram) {
      gl.deleteProgram(this.currentProgram);
    }
    this.currentProgram = program;

    // Load any texture URLs from uniforms
    this.updateTextureUniforms();

    this.reportStatus(true);
  }

  private updateTextureUniforms() {
    const gl = this.gl;
    Object.values(this.uniforms).forEach((u) => {
      if (u.type === "sampler2D" && typeof u.value === "string" && !this.textures.has(u.name)) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const tex = gl.createTexture();
          if (tex) {
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            this.textures.set(u.name, tex);
          }
        };
        img.src = u.value;
      }
    });
  }

  private reportStatus(success: boolean, error?: string) {
    if (this.onCompileStatus) {
      this.onCompileStatus({ success, error });
    }
  }

  private setupInteractions() {
    const c = this.canvas;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      this.mouse.isDragging = true;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      this.mouse.lastX = clientX;
      this.mouse.lastY = clientY;
    };

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      const rect = c.getBoundingClientRect();
      this.mouse.x = (clientX - rect.left) / rect.width;
      this.mouse.y = 1.0 - (clientY - rect.top) / rect.height;

      if (!this.mouse.isDragging || this.currentGeometry === "quad") return;

      const deltaX = clientX - this.mouse.lastX;
      const deltaY = clientY - this.mouse.lastY;
      this.mouse.lastX = clientX;
      this.mouse.lastY = clientY;

      this.camera.rotationY += deltaX * 0.01;
      this.camera.rotationX += deltaY * 0.01;
      this.camera.rotationX = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.camera.rotationX));
    };

    const onPointerUp = () => {
      this.mouse.isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (this.currentGeometry === "quad") return;
      this.camera.distance += e.deltaY * 0.005;
      this.camera.distance = Math.max(1.0, Math.min(15.0, this.camera.distance));
    };

    c.addEventListener("mousedown", onPointerDown);
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);
    c.addEventListener("wheel", onWheel, { passive: false });

    c.addEventListener("touchstart", onPointerDown, { passive: true });
    window.addEventListener("touchmove", onPointerMove, { passive: true });
    window.addEventListener("touchend", onPointerUp);
  }

  private startRenderLoop() {
    const render = () => {
      this.renderFrame();
      this.animationFrameId = requestAnimationFrame(render);
    };
    this.animationFrameId = requestAnimationFrame(render);
  }

  public renderFrame() {
    const gl = this.gl;
    const c = this.canvas;

    // Resize viewport if canvas dimensions shifted
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const displayWidth = Math.floor(c.clientWidth * dpr);
    const displayHeight = Math.floor(c.clientHeight * dpr);
    if (c.width !== displayWidth || c.height !== displayHeight) {
      c.width = displayWidth;
      c.height = displayHeight;
    }
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (!this.currentProgram) return;
    gl.useProgram(this.currentProgram);

    // Compute matrices
    const aspect = c.width / Math.max(c.height, 1);
    const projMatrix = this.createPerspectiveMatrix((this.camera.fov * Math.PI) / 180, aspect, 0.1, 100.0);

    const isQuad = this.currentGeometry === "quad";
    const mvMatrix = isQuad ? this.createIdentityMatrix() : this.createModelViewMatrix();
    const normalMatrix = this.createNormalMatrix(mvMatrix);

    // Bind system matrices
    this.setMat4Uniform("u_projectionMatrix", projMatrix);
    this.setMat4Uniform("u_modelViewMatrix", mvMatrix);
    this.setMat3Uniform("u_normalMatrix", normalMatrix);

    // Bind standard uniforms
    const elapsedTime = (performance.now() - this.startTime) * 0.001;
    this.setFloatUniform("u_time", elapsedTime);
    this.setVec2Uniform("u_resolution", [c.width, c.height]);
    this.setVec2Uniform("u_mouse", [this.mouse.x, this.mouse.y]);

    // Bind custom graph uniforms
    let textureSlot = 0;
    Object.values(this.uniforms).forEach((u) => {
      if (u.type === "float") {
        this.setFloatUniform(u.name, typeof u.value === "number" ? u.value : 0);
      } else if (u.type === "vec2") {
        this.setVec2Uniform(u.name, Array.isArray(u.value) ? u.value : [u.value?.x || 0, u.value?.y || 0]);
      } else if (u.type === "vec3") {
        this.setVec3Uniform(u.name, Array.isArray(u.value) ? u.value : [u.value?.x || 0, u.value?.y || 0, u.value?.z || 0]);
      } else if (u.type === "sampler2D") {
        const tex = this.textures.get(u.name) || this.defaultTexture;
        if (tex) {
          gl.activeTexture(gl.TEXTURE0 + textureSlot);
          gl.bindTexture(gl.TEXTURE_2D, tex);
          const loc = gl.getUniformLocation(this.currentProgram!, u.name);
          if (loc) gl.uniform1i(loc, textureSlot);
          textureSlot++;
        }
      }
    });

    // Render active geometry
    const mesh = this.meshMap.get(this.currentGeometry);
    if (!mesh) return;

    gl.bindVertexArray(mesh.vao);
    if (mesh.indexBuffer) {
      gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
    } else {
      gl.drawArrays(gl.TRIANGLES, 0, mesh.indexCount);
    }
    gl.bindVertexArray(null);
  }

  // Uniform helper functions
  private setFloatUniform(name: string, val: number) {
    const loc = this.gl.getUniformLocation(this.currentProgram!, name);
    if (loc) this.gl.uniform1f(loc, val);
  }
  private setVec2Uniform(name: string, val: [number, number]) {
    const loc = this.gl.getUniformLocation(this.currentProgram!, name);
    if (loc) this.gl.uniform2f(loc, val[0], val[1]);
  }
  private setVec3Uniform(name: string, val: [number, number, number]) {
    const loc = this.gl.getUniformLocation(this.currentProgram!, name);
    if (loc) this.gl.uniform3f(loc, val[0], val[1], val[2]);
  }
  private setMat3Uniform(name: string, val: Float32Array) {
    const loc = this.gl.getUniformLocation(this.currentProgram!, name);
    if (loc) this.gl.uniformMatrix3fv(loc, false, val);
  }
  private setMat4Uniform(name: string, val: Float32Array) {
    const loc = this.gl.getUniformLocation(this.currentProgram!, name);
    if (loc) this.gl.uniformMatrix4fv(loc, false, val);
  }

  // Geometry generators
  private createSphere(radius: number, lats: number, lons: number): MeshBuffers {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let lat = 0; lat <= lats; lat++) {
      const theta = (lat * Math.PI) / lats;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      for (let lon = 0; lon <= lons; lon++) {
        const phi = (lon * 2 * Math.PI) / lons;
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);

        const x = cosPhi * sinTheta;
        const y = cosTheta;
        const z = sinPhi * sinTheta;
        const u = 1 - lon / lons;
        const v = 1 - lat / lats;

        normals.push(x, y, z);
        uvs.push(u, v);
        positions.push(radius * x, radius * y, radius * z);
      }
    }

    for (let lat = 0; lat < lats; lat++) {
      for (let lon = 0; lon < lons; lon++) {
        const first = lat * (lons + 1) + lon;
        const second = first + lons + 1;
        indices.push(first, second, first + 1);
        indices.push(second, second + 1, first + 1);
      }
    }

    return this.buildMeshBuffers(positions, normals, uvs, indices);
  }

  private createCube(size: number): MeshBuffers {
    const s = size / 2;
    // prettier-ignore
    const positions = [
      // Front
      -s, -s,  s,   s, -s,  s,   s,  s,  s,  -s,  s,  s,
      // Back
      -s, -s, -s,  -s,  s, -s,   s,  s, -s,   s, -s, -s,
      // Top
      -s,  s, -s,  -s,  s,  s,   s,  s,  s,   s,  s, -s,
      // Bottom
      -s, -s, -s,   s, -s, -s,   s, -s,  s,  -s, -s,  s,
      // Right
       s, -s, -s,   s,  s, -s,   s,  s,  s,   s, -s,  s,
      // Left
      -s, -s, -s,  -s, -s,  s,  -s,  s,  s,  -s,  s, -s,
    ];

    // prettier-ignore
    const normals = [
      // Front
       0,  0,  1,   0,  0,  1,   0,  0,  1,   0,  0,  1,
      // Back
       0,  0, -1,   0,  0, -1,   0,  0, -1,   0,  0, -1,
      // Top
       0,  1,  0,   0,  1,  0,   0,  1,  0,   0,  1,  0,
      // Bottom
       0, -1,  0,   0, -1,  0,   0, -1,  0,   0, -1,  0,
      // Right
       1,  0,  0,   1,  0,  0,   1,  0,  0,   1,  0,  0,
      // Left
      -1,  0,  0,  -1,  0,  0,  -1,  0,  0,  -1,  0,  0,
    ];

    const uvs: number[] = [];
    for (let i = 0; i < 6; i++) {
      uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    }

    const indices: number[] = [];
    for (let i = 0; i < 6; i++) {
      const offset = i * 4;
      indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
    }

    return this.buildMeshBuffers(positions, normals, uvs, indices);
  }

  private createPlane(width: number, height: number, segX: number, segY: number): MeshBuffers {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const halfW = width / 2;
    const halfH = height / 2;

    for (let y = 0; y <= segY; y++) {
      const v = y / segY;
      const posY = -halfH + v * height;
      for (let x = 0; x <= segX; x++) {
        const u = x / segX;
        const posX = -halfW + u * width;
        positions.push(posX, posY, 0);
        normals.push(0, 0, 1);
        uvs.push(u, v);
      }
    }

    for (let y = 0; y < segY; y++) {
      for (let x = 0; x < segX; x++) {
        const row1 = y * (segX + 1);
        const row2 = (y + 1) * (segX + 1);
        indices.push(row1 + x, row2 + x, row1 + x + 1);
        indices.push(row1 + x + 1, row2 + x, row2 + x + 1);
      }
    }

    return this.buildMeshBuffers(positions, normals, uvs, indices);
  }

  private createQuad(): MeshBuffers {
    // Fullscreen quad in NDC [-1, 1]
    // prettier-ignore
    const positions = [
      -1.0, -1.0, 0.0,
       1.0, -1.0, 0.0,
      -1.0,  1.0, 0.0,
      -1.0,  1.0, 0.0,
       1.0, -1.0, 0.0,
       1.0,  1.0, 0.0,
    ];
    // prettier-ignore
    const normals = [
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
    ];
    // prettier-ignore
    const uvs = [
      0.0, 0.0,
      1.0, 0.0,
      0.0, 1.0,
      0.0, 1.0,
      1.0, 0.0,
      1.0, 1.0,
    ];

    return this.buildMeshBuffers(positions, normals, uvs, undefined);
  }

  private buildMeshBuffers(
    positions: number[],
    normals: number[],
    uvs: number[],
    indices?: number[]
  ): MeshBuffers {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);

    // Positions (Location 0)
    const positionBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    // Normals (Location 1)
    const normalBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(1);

    // UVs (Location 2)
    const uvBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(2);

    let indexBuffer: WebGLBuffer | undefined;
    let indexCount = positions.length / 3;

    if (indices) {
      indexBuffer = gl.createBuffer()!;
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
      indexCount = indices.length;
    }

    gl.bindVertexArray(null);

    return { vao, positionBuffer, normalBuffer, uvBuffer, indexBuffer, indexCount };
  }

  // Math Helpers
  private createIdentityMatrix(): Float32Array {
    const out = new Float32Array(16);
    out[0] = 1;
    out[5] = 1;
    out[10] = 1;
    out[15] = 1;
    return out;
  }

  private createPerspectiveMatrix(fovy: number, aspect: number, near: number, far: number): Float32Array {
    const out = new Float32Array(16);
    const f = 1.0 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[14] = 2 * far * near * nf;
    return out;
  }

  private createModelViewMatrix(): Float32Array {
    const out = this.createIdentityMatrix();
    // Translation back by distance
    out[14] = -this.camera.distance;

    // Rotate X
    const cosX = Math.cos(this.camera.rotationX);
    const sinX = Math.sin(this.camera.rotationX);
    const cosY = Math.cos(this.camera.rotationY);
    const sinY = Math.sin(this.camera.rotationY);

    // Combined rotation Y * X
    out[0] = cosY;
    out[1] = sinX * sinY;
    out[2] = -cosX * sinY;

    out[4] = 0;
    out[5] = cosX;
    out[6] = sinX;

    out[8] = sinY;
    out[9] = -sinX * cosY;
    out[10] = cosX * cosY;

    return out;
  }

  private createNormalMatrix(mv: Float32Array): Float32Array {
    const out = new Float32Array(9);
    // Upper-left 3x3 of modelView
    out[0] = mv[0]; out[1] = mv[1]; out[2] = mv[2];
    out[3] = mv[4]; out[4] = mv[5]; out[5] = mv[6];
    out[6] = mv[8]; out[7] = mv[9]; out[8] = mv[10];
    return out;
  }

  public dispose() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    const gl = this.gl;
    if (this.currentProgram) {
      gl.deleteProgram(this.currentProgram);
    }
    this.meshMap.forEach((m) => {
      gl.deleteVertexArray(m.vao);
      gl.deleteBuffer(m.positionBuffer);
      gl.deleteBuffer(m.normalBuffer);
      gl.deleteBuffer(m.uvBuffer);
      if (m.indexBuffer) gl.deleteBuffer(m.indexBuffer);
    });
    this.textures.forEach((tex) => gl.deleteTexture(tex));
    if (this.defaultTexture) gl.deleteTexture(this.defaultTexture);
  }
}
