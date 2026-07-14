/**
 * Minimal WebGL renderer for shader preview.
 * Compiles vertex + fragment shaders, renders a full-screen quad, and animates uniforms.
 */

import { SHADER_VERTEX_SOURCE } from "./shaderPresets.js";

export interface ShaderRenderer {
  destroy: () => void;
  setParameter: (name: string, value: number) => void;
  resize: (width: number, height: number) => void;
}

interface RendererInternal {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
  params: Record<string, number>;
  startTime: number;
  rafId: number | null;
  buffer: WebGLBuffer;
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${log}`);
  }
  return shader;
}

/**
 * Create a shader renderer attached to a canvas.
 * Returns a controller for setting parameters, resizing, and destroying.
 */
export function createShaderRenderer(
  canvas: HTMLCanvasElement,
  fragmentSource: string,
  initialParams: Record<string, number> = {},
): ShaderRenderer {
  const ctx = canvas.getContext("webgl", { antialias: true, premultipliedAlpha: false });
  if (!ctx) throw new Error("WebGL not supported");
  const gl: WebGLRenderingContext = ctx;

  const vs = compileShader(gl, gl.VERTEX_SHADER, SHADER_VERTEX_SOURCE);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  const program = gl.createProgram();
  if (!program) throw new Error("Failed to create program");
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${log}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const timeLoc = gl.getUniformLocation(program, "u_time");
  const resLoc = gl.getUniformLocation(program, "u_resolution");
  const paramLocs: Record<string, WebGLUniformLocation | null> = {};

  for (const [name, value] of Object.entries(initialParams)) {
    paramLocs[name] = gl.getUniformLocation(program, `u_${name}`);
  }

  const state: RendererInternal = {
    gl,
    program,
    uniforms: paramLocs,
    params: { ...initialParams },
    startTime: performance.now(),
    rafId: null,
    buffer,
  };

  function render() {
    const time = (performance.now() - state.startTime) / 1000;
    gl.uniform1f(timeLoc, time);
    if (resLoc) gl.uniform2f(resLoc, canvas.width, canvas.height);
    for (const [name, loc] of Object.entries(state.uniforms)) {
      if (loc) gl.uniform1f(loc, state.params[name] ?? 0);
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    state.rafId = requestAnimationFrame(render);
  }

  render();

  return {
    setParameter(name, value) {
      if (!(name in state.uniforms)) {
        state.uniforms[name] = gl.getUniformLocation(program, `u_${name}`);
      }
      state.params[name] = value;
    },
    resize(width, height) {
      canvas.width = width;
      canvas.height = height;
    },
    destroy() {
      if (state.rafId !== null) cancelAnimationFrame(state.rafId);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
}
