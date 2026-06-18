import fragmentShaderSource from './shaders/holographic-card.frag.glsl?raw'
import vertexShaderSource from './shaders/holographic-card.vert.glsl?raw'

export interface HolographicCardOptions {
  /** URL of the alpha map defining the card's silhouette. */
  shapeTextureUrl: string
  /** URL of the golden foil alpha map shown on the card's front face. */
  frontTextureUrl: string
  /** URL of the golden foil alpha map shown on the card's back face. */
  backTextureUrl: string
  /**
   * Called with the shape texture's natural pixel size once it has loaded.
   * The shape's dimensions are meant to drive the card's aspect ratio, so the
   * render adapts to whatever silhouette (and format) the artist provides.
   */
  onShapeSize?: (width: number, height: number) => void
}

const QUAD_VERTICES = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])

// Camera distance and card scale governing the perspective turn. The card is
// scaled to leave a little margin so its corners never clip the canvas as it
// rotates toward the viewer.
const CAMERA_DISTANCE = 4
const MODEL_SCALE = 0.9
const NEAR = 1
const FAR = 10

/**
 * Renders an holographic card effect into a canvas using WebGL2.
 *
 * The card is a plane that can be turned over in 3D via {@link setOrientation}
 * (pointer-drag) to reveal a distinct back face, or have its reflection sheen
 * nudged in place via {@link setTilt} (gyroscope).
 */
export class HolographicCard {
  private readonly gl: WebGL2RenderingContext
  private readonly uniforms: {
    uTilt: WebGLUniformLocation | null
    uMvp: WebGLUniformLocation | null
    uShapeTex: WebGLUniformLocation | null
    uFrontFoilTex: WebGLUniformLocation | null
    uBackFoilTex: WebGLUniformLocation | null
  }

  // The sheen is driven by two independent contributions that are summed at
  // render time, so the pointer (orientation) and gyroscope (tilt) paths can be
  // active at once without overwriting each other.
  private orientTiltX = 0
  private orientTiltY = 0
  private gyroTiltX = 0
  private gyroTiltY = 0
  private rafId: number | null = null
  /** Constant projection * view matrix (the card only contributes a model rotation). */
  private readonly projectionView: Float32Array
  private mvp: Float32Array
  /** The textures backing each sampler, kept so they can be replaced at runtime. */
  private readonly textures: { shape: WebGLTexture; front: WebGLTexture; back: WebGLTexture }
  private readonly onShapeSize?: (width: number, height: number) => void

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
      uMvp: gl.getUniformLocation(program, 'uMvp'),
      uShapeTex: gl.getUniformLocation(program, 'uShapeTex'),
      uFrontFoilTex: gl.getUniformLocation(program, 'uFrontFoilTex'),
      uBackFoilTex: gl.getUniformLocation(program, 'uBackFoilTex'),
    }

    this.onShapeSize = options.onShapeSize
    this.textures = {
      shape: this.createPlaceholderTexture(gl.TEXTURE0),
      front: this.createPlaceholderTexture(gl.TEXTURE1),
      back: this.createPlaceholderTexture(gl.TEXTURE2),
    }
    this.loadFromUrl(this.textures.shape, gl.TEXTURE0, options.shapeTextureUrl, (image) => {
      this.onShapeSize?.(image.naturalWidth, image.naturalHeight)
    })
    this.loadFromUrl(this.textures.front, gl.TEXTURE1, options.frontTextureUrl)
    this.loadFromUrl(this.textures.back, gl.TEXTURE2, options.backTextureUrl)
    gl.uniform1i(this.uniforms.uShapeTex, 0)
    gl.uniform1i(this.uniforms.uFrontFoilTex, 1)
    gl.uniform1i(this.uniforms.uBackFoilTex, 2)

    // The card's front face looks toward the camera, which sits back along +z.
    const projection = perspective(2 * Math.atan(1 / CAMERA_DISTANCE), 1, NEAR, FAR)
    const view = translationZ(-CAMERA_DISTANCE)
    this.projectionView = multiply(projection, view)
    this.mvp = this.projectionView
    this.setOrientation(0, 0)

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  }

  /**
   * Sets the sheen tilt directly, without rotating the card. Intended for the
   * gyroscope path, where rotating the card alongside the device would feel
   * disorienting and only the reflection should react. This contribution is
   * summed with the orientation-derived sheen, so it can coexist with
   * pointer-drag rotation (see {@link setOrientation}).
   */
  setTilt(tiltX: number, tiltY: number): void {
    this.gyroTiltX = tiltX
    this.gyroTiltY = tiltY
  }

  /**
   * Orients the card in 3D, in radians. `rotX` tilts it around its horizontal
   * axis, `rotY` turns it around its vertical axis (past ±90° reveals the back
   * face). The reflection sheen is derived from this orientation.
   */
  setOrientation(rotX: number, rotY: number): void {
    const model = multiply(multiply(rotationX(rotX), rotationY(rotY)), scaling(MODEL_SCALE))
    this.mvp = multiply(this.projectionView, model)
    this.orientTiltX = Math.sin(rotY)
    this.orientTiltY = Math.sin(rotX)
  }

  /**
   * Replaces the silhouette alpha map. Its dimensions are reported through the
   * `onShapeSize` callback so the card can re-adapt its aspect ratio.
   */
  setShapeImage(image: HTMLImageElement): void {
    this.uploadImage(this.textures.shape, this.gl.TEXTURE0, image)
    this.onShapeSize?.(image.naturalWidth, image.naturalHeight)
  }

  /** Replaces the golden foil alpha map shown on the front face. */
  setFrontImage(image: HTMLImageElement): void {
    this.uploadImage(this.textures.front, this.gl.TEXTURE1, image)
  }

  /** Replaces the golden foil alpha map shown on the back face. */
  setBackImage(image: HTMLImageElement): void {
    this.uploadImage(this.textures.back, this.gl.TEXTURE2, image)
  }

  /** Creates a texture bound to `unit`, holding a 1x1 transparent placeholder. */
  private createPlaceholderTexture(unit: number): WebGLTexture {
    const { gl } = this
    const texture = gl.createTexture()
    gl.activeTexture(unit)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]))
    return texture
  }

  /** Uploads an image into the given texture and (re)applies its sampling parameters. */
  private uploadImage(texture: WebGLTexture, unit: number, source: TexImageSource): void {
    const { gl } = this
    gl.activeTexture(unit)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  }

  /** Loads an image from a URL into the given texture, uploading it once ready. */
  private loadFromUrl(
    texture: WebGLTexture,
    unit: number,
    url: string,
    onLoad?: (image: HTMLImageElement) => void,
  ): void {
    const image = new Image()
    image.onload = () => {
      this.uploadImage(texture, unit, image)
      onLoad?.(image)
    }
    image.src = url
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
    gl.uniform2f(uniforms.uTilt, this.orientTiltX + this.gyroTiltX, this.orientTiltY + this.gyroTiltY)
    gl.uniformMatrix4fv(uniforms.uMvp, false, this.mvp)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }
}

// --- Minimal column-major 4x4 matrix helpers (avoids a matrix dependency) ---

/** Returns the matrix product `a * b`. */
function multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16)
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let sum = 0
      for (let k = 0; k < 4; k++) {
        sum += (a[k * 4 + r] ?? 0) * (b[c * 4 + k] ?? 0)
      }
      out[c * 4 + r] = sum
    }
  }
  return out
}

function perspective(fovY: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan(fovY / 2)
  const rangeInv = 1 / (near - far)
  // biome-ignore format: matrix layout is clearer in a grid
  return new Float32Array([
    f / aspect, 0, 0,                        0,
    0,          f, 0,                        0,
    0,          0, (far + near) * rangeInv, -1,
    0,          0, 2 * far * near * rangeInv, 0,
  ])
}

function translationZ(z: number): Float32Array {
  // biome-ignore format: matrix layout is clearer in a grid
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, z, 1,
  ])
}

function rotationX(a: number): Float32Array {
  const c = Math.cos(a)
  const s = Math.sin(a)
  // biome-ignore format: matrix layout is clearer in a grid
  return new Float32Array([
    1, 0,  0, 0,
    0, c,  s, 0,
    0, -s, c, 0,
    0, 0,  0, 1,
  ])
}

function rotationY(a: number): Float32Array {
  const c = Math.cos(a)
  const s = Math.sin(a)
  // biome-ignore format: matrix layout is clearer in a grid
  return new Float32Array([
    c, 0, -s, 0,
    0, 1,  0, 0,
    s, 0,  c, 0,
    0, 0,  0, 1,
  ])
}

function scaling(s: number): Float32Array {
  // biome-ignore format: matrix layout is clearer in a grid
  return new Float32Array([
    s, 0, 0, 0,
    0, s, 0, 0,
    0, 0, s, 0,
    0, 0, 0, 1,
  ])
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
