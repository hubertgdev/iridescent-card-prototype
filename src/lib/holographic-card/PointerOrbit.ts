export interface PointerOrbitOptions {
  /** Rotation applied per pixel dragged, in radians. Defaults to 0.01. */
  sensitivity?: number
  /** Easing factor toward the target orientation each frame, in `[0, 1]`. Defaults to 0.12. */
  easing?: number
  /** Whether to settle on the nearest face (front/back), level, on release. Defaults to true. */
  snapToFace?: boolean
  /** Called every frame with the current orientation, in radians. */
  onChange: (rotX: number, rotY: number) => void
}

const HALF_TURN = Math.PI
const FULL_TURN = 2 * Math.PI

/**
 * Tracks click+drag on an element and reports an accumulated 3D orientation,
 * letting the card be turned over freely. On release it can settle back to the
 * nearest face. Intended to drive {@link HolographicCard.setOrientation}.
 */
export class PointerOrbit {
  private readonly sensitivity: number
  private readonly easing: number
  private readonly snapToFace: boolean
  private readonly onChange: (rotX: number, rotY: number) => void
  private readonly element: HTMLElement

  private targetX = 0
  private targetY = 0
  private currentX = 0
  private currentY = 0
  private lastPointerX = 0
  private lastPointerY = 0
  private rafId: number | null = null

  constructor(element: HTMLElement, options: PointerOrbitOptions) {
    this.element = element
    this.sensitivity = options.sensitivity ?? 0.01
    this.easing = options.easing ?? 0.12
    this.snapToFace = options.snapToFace ?? true
    this.onChange = options.onChange

    this.element.addEventListener('pointerdown', this.handlePointerDown)
    window.addEventListener('pointermove', this.handlePointerMove)
    window.addEventListener('pointerup', this.handlePointerUp)

    this.loop()
  }

  /** Stops the render loop and removes event listeners. */
  destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.element.removeEventListener('pointerdown', this.handlePointerDown)
    window.removeEventListener('pointermove', this.handlePointerMove)
    window.removeEventListener('pointerup', this.handlePointerUp)
  }

  private handlePointerDown = (event: PointerEvent): void => {
    this.lastPointerX = event.clientX
    this.lastPointerY = event.clientY
    this.element.setPointerCapture(event.pointerId)
  }

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.element.hasPointerCapture(event.pointerId)) return
    // Drag accumulates rotation: horizontal turns around the vertical axis,
    // vertical tilts around the horizontal axis.
    this.targetY += (event.clientX - this.lastPointerX) * this.sensitivity
    this.targetX += (event.clientY - this.lastPointerY) * this.sensitivity
    this.lastPointerX = event.clientX
    this.lastPointerY = event.clientY
  }

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.element.hasPointerCapture(event.pointerId)) return
    this.element.releasePointerCapture(event.pointerId)
    if (this.snapToFace) {
      // Settle facing the viewer: level (rotX a multiple of a full turn) and on
      // the nearest face (rotY a multiple of a half turn — front or back).
      this.targetX = Math.round(this.targetX / FULL_TURN) * FULL_TURN
      this.targetY = Math.round(this.targetY / HALF_TURN) * HALF_TURN
    }
  }

  private loop = (): void => {
    this.currentX += (this.targetX - this.currentX) * this.easing
    this.currentY += (this.targetY - this.currentY) * this.easing
    this.onChange(this.currentX, this.currentY)
    this.rafId = requestAnimationFrame(this.loop)
  }
}
