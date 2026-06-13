import fragmentShaderSource from './shaders/holographic-card.frag.glsl?raw'
import vertexShaderSource from './shaders/holographic-card.vert.glsl?raw'

export interface HolographicCardOptions {
  /** URL of the alpha map defining the card's silhouette. */
  shapeTextureUrl: string
  /** URL of the alpha map defining the golden areas and their intensity. */
  goldTextureUrl: string
}

const QUAD_VERTICES = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])

/**
 * Renders an holographic card effect into a canvas using WebGL2.
 *
 * The card surface reacts to a "tilt" value (set via {@link setTilt}),
 * which is meant to be driven by a pointer-drag interaction.
 */
export class HolographicCard {
  private readonly gl: WebGL2RenderingContext
  private readonly uniforms: {
    uTilt: WebGLUniformLocation | null
    uShapeTex: WebGLUniformLocation | null
    uGoldTex: WebGLUniformLocation | null
  }

  private tiltX = 0
  private tiltY = 0
  private rafId: number | null = null

  constructor(canvas: HTMLCanvasElement, options: HolographicCardOptions) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
    })
    if (!gl) {
      throw new Error('WebGL2 is not supported by this browser')
    }
    this.gl = gl

    const program = createProgram(gl, vertexShaderSource, fragmentShaderSource)
    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW)

    const aPosition = gl.getAttribLocation(program, 'aPosition')
    gl.enableVertexAttribArray(aPosition)
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0)

    this.uniforms = {
      uTilt: gl.getUniformLocation(program, 'uTilt'),
      uShapeTex: gl.getUniformLocation(program, 'uShapeTex'),
      uGoldTex: gl.getUniformLocation(program, 'uGoldTex'),
    }

    loadTexture(gl, options.shapeTextureUrl, gl.TEXTURE0)
    loadTexture(gl, options.goldTextureUrl, gl.TEXTURE1)
    gl.uniform1i(this.uniforms.uShapeTex, 0)
    gl.uniform1i(this.uniforms.uGoldTex, 1)

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  }

  /** Sets the current tilt of the card, in radians. */
  setTilt(tiltX: number, tiltY: number): void {
    this.tiltX = tiltX
    this.tiltY = tiltY
  }

  /** Resizes the drawing buffer to match the given CSS size. */
  resize(cssWidth: number, cssHeight: number): void {
    const dpr = window.devicePixelRatio || 1
    const canvas = this.gl.canvas as HTMLCanvasElement
    canvas.width = Math.max(1, Math.round(cssWidth * dpr))
    canvas.height = Math.max(1, Math.round(cssHeight * dpr))
    this.gl.viewport(0, 0, canvas.width, canvas.height)
  }

  /** Starts the render loop. */
  start(): void {
    if (this.rafId !== null) return
    const loop = () => {
      this.render()
      this.rafId = requestAnimationFrame(loop)
    }
    this.rafId = requestAnimationFrame(loop)
  }

  /** Stops the render loop. */
  stop(): void {
    if (this.rafId === null) return
    cancelAnimationFrame(this.rafId)
    this.rafId = null
  }

  private render(): void {
    const { gl, uniforms } = this
    gl.uniform2f(uniforms.uTilt, this.tiltX, this.tiltY)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }
}

function loadTexture(gl: WebGL2RenderingContext, url: string, unit: number): void {
  const texture = gl.createTexture()
  gl.activeTexture(unit)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  // 1x1 transparent placeholder until the image has loaded.
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]))

  const image = new Image()
  image.onload = () => {
    gl.activeTexture(unit)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  }
  image.src = url
}

function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Failed to create shader')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader compile error: ${info}`)
  }
  return shader
}

function createProgram(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
  const program = gl.createProgram()
  if (!program) throw new Error('Failed to create program')

  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource)
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`Program link error: ${info}`)
  }

  return program
}
