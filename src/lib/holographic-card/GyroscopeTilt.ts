export interface GyroscopeTiltOptions {
  /** Maximum tilt angle, in radians, reached at {@link sensitivity} degrees of device rotation. Defaults to 0.35. */
  maxTilt?: number
  /** Device rotation, in degrees, that maps to {@link maxTilt}. Defaults to 30. */
  sensitivity?: number
  /** Spring-back easing factor applied each frame, in `[0, 1]`. Defaults to 0.12. */
  easing?: number
  /** Called every frame with the current tilt, in radians. */
  onChange: (tiltX: number, tiltY: number) => void
}

/**
 * iOS 13+ requires `DeviceOrientationEvent.requestPermission()` to be called
 * from a user gesture before `deviceorientation` events are fired.
 */
type DeviceOrientationEventConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

/**
 * Tracks the device orientation and reports an eased "tilt" value relative
 * to the orientation at the time of construction. Intended to drive
 * {@link HolographicCard.setTilt} on mobile devices.
 */
export class GyroscopeTilt {
  private readonly maxTilt: number
  private readonly sensitivity: number
  private readonly easing: number
  private readonly onChange: (tiltX: number, tiltY: number) => void

  private baseBeta: number | null = null
  private baseGamma: number | null = null
  private targetX = 0
  private targetY = 0
  private currentX = 0
  private currentY = 0
  private rafId: number | null = null

  constructor(options: GyroscopeTiltOptions) {
    this.maxTilt = options.maxTilt ?? 0.35
    this.sensitivity = options.sensitivity ?? 30
    this.easing = options.easing ?? 0.12
    this.onChange = options.onChange

    window.addEventListener('deviceorientation', this.handleOrientation)
    this.loop()
  }

  /** Whether the device exposes orientation data at all. */
  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window
  }

  /**
   * Requests permission to read device orientation, if required by the
   * platform (iOS 13+). Must be called from within a user gesture handler.
   * Resolves to `true` if orientation events can be listened to.
   */
  static async requestPermission(): Promise<boolean> {
    const ctor = DeviceOrientationEvent as DeviceOrientationEventConstructor
    if (typeof ctor.requestPermission !== 'function') return true
    try {
      return (await ctor.requestPermission()) === 'granted'
    } catch {
      return false
    }
  }

  /** Stops the render loop and removes event listeners. */
  destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    window.removeEventListener('deviceorientation', this.handleOrientation)
  }

  private handleOrientation = (event: DeviceOrientationEvent): void => {
    if (event.beta === null || event.gamma === null) return

    // Use the orientation at the first reading as the "flat" reference.
    if (this.baseBeta === null || this.baseGamma === null) {
      this.baseBeta = event.beta
      this.baseGamma = event.gamma
    }

    const deltaGamma = event.gamma - this.baseGamma
    const deltaBeta = event.beta - this.baseBeta
    this.targetX = clamp(deltaGamma / this.sensitivity, -1, 1) * this.maxTilt
    this.targetY = clamp(deltaBeta / this.sensitivity, -1, 1) * this.maxTilt
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
