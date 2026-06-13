export interface PointerTiltOptions {
  /** Maximum tilt angle, in radians, reached at the edge of the drag range. Defaults to 0.35. */
  maxTilt?: number
  /** Drag distance, in pixels, that maps to {@link maxTilt}. Defaults to 200. */
  range?: number
  /** Spring-back easing factor applied each frame, in `[0, 1]`. Defaults to 0.12. */
  easing?: number
  /** Called every frame with the current tilt, in radians. */
  onChange: (tiltX: number, tiltY: number) => void
}

/**
 * Tracks click+drag on an element and reports an eased "tilt" value that
 * springs back to zero on release. Intended to drive {@link HolographicCard.setTilt}.
 */
export class PointerTilt {
  private readonly maxTilt: number
  private readonly range: number
  private readonly easing: number
  private readonly onChange: (tiltX: number, tiltY: number) => void

  private targetX = 0
  private targetY = 0
  private currentX = 0
  private currentY = 0
  private dragStartX = 0
  private dragStartY = 0
  private rafId: number | null = null
  private readonly element: HTMLElement

  constructor(element: HTMLElement, options: PointerTiltOptions) {
    this.element = element
    this.maxTilt = options.maxTilt ?? 0.35
    this.range = options.range ?? 200
    this.easing = options.easing ?? 0.12
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
    this.dragStartX = event.clientX
    this.dragStartY = event.clientY
    this.element.setPointerCapture(event.pointerId)
  }

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.element.hasPointerCapture(event.pointerId)) return
    const dx = event.clientX - this.dragStartX
    const dy = event.clientY - this.dragStartY
    this.targetX = clamp(dx / this.range, -1, 1) * this.maxTilt
    this.targetY = clamp(dy / this.range, -1, 1) * this.maxTilt
  }

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.element.hasPointerCapture(event.pointerId)) return
    this.element.releasePointerCapture(event.pointerId)
    this.targetX = 0
    this.targetY = 0
  }

  private loop = (): void => {
    this.currentX += (this.targetX - this.currentX) * this.easing
    this.currentY += (this.targetY - this.currentY) * this.easing
    this.onChange(this.currentX, this.currentY)
    this.rafId = requestAnimationFrame(this.loop)
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
