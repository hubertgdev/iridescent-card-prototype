import './style.css'
import { GyroscopeTilt, HolographicCard, PointerOrbit } from '@/lib/holographic-card'

console.log(`Ready! Version: ${__APP_VERSION__}`)

const containerElement = document.querySelector<HTMLDivElement>('#card')
const canvas = document.querySelector<HTMLCanvasElement>('#card-canvas')

if (!containerElement || !canvas) {
  throw new Error('Could not find the card elements')
}

const container = containerElement

const card = new HolographicCard(canvas, {
  shapeTextureUrl: `${import.meta.env.BASE_URL}shape.png`,
  frontTextureUrl: `${import.meta.env.BASE_URL}gold.png`,
  backTextureUrl: `${import.meta.env.BASE_URL}back.png`,
  // The shape silhouette drives the card's aspect ratio, so the render adapts
  // to whatever format (5:7, tarot 7:12, arbitrary…) the artist's shape uses.
  onShapeSize: (width, height) => {
    container.style.aspectRatio = `${width} / ${height}`
    resize()
  },
})

function resize() {
  const { width, height } = container.getBoundingClientRect()
  card.resize(width, height)
}

window.addEventListener('resize', resize)
resize()
card.start()

// Drag turns the card in 3D (handled in the shader), revealing its back face
// past a half turn. The reflection sheen follows the orientation.
function handleOrbit(rotX: number, rotY: number) {
  card.setOrientation(rotX, rotY)
}

// Gyroscope only drives the shader's reflection: rotating the card itself
// alongside the screen would feel disorienting.
function handleGyroscopeTilt(tiltX: number, tiltY: number) {
  card.setTilt(tiltX, tiltY)
}

// Let the artist swap any of the alpha maps from their own files. The image is
// read locally (no upload, no storage) and pushed straight to the shader.
function readImage(file: File | undefined, apply: (image: HTMLImageElement) => void) {
  if (!file?.type.startsWith('image/')) return
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.onload = () => {
    apply(image)
    URL.revokeObjectURL(url)
  }
  image.src = url
}

// Each button works both as a file picker (click) and a drop target.
function wireUpload(inputId: string, apply: (image: HTMLImageElement) => void) {
  const input = document.querySelector<HTMLInputElement>(inputId)
  const button = input?.closest<HTMLLabelElement>('.control')
  if (!input || !button) return

  input.addEventListener('change', () => {
    readImage(input.files?.[0], apply)
    // Allow re-selecting the same file to trigger another change.
    input.value = ''
  })

  button.addEventListener('dragover', (event) => {
    event.preventDefault()
    button.classList.add('control--dragover')
  })
  button.addEventListener('dragleave', () => {
    button.classList.remove('control--dragover')
  })
  button.addEventListener('drop', (event) => {
    event.preventDefault()
    button.classList.remove('control--dragover')
    readImage(event.dataTransfer?.files?.[0], apply)
  })
}

wireUpload('#upload-front', (image) => card.setFrontImage(image))
wireUpload('#upload-back', (image) => card.setBackImage(image))
wireUpload('#upload-shape', (image) => card.setShapeImage(image))

// Touch+drag always rotates the card. It is created synchronously so the very
// first pointerdown — which also doubles as the gyroscope permission gesture on
// iOS — still registers as the start of a drag instead of being swallowed.
new PointerOrbit(container, { onChange: handleOrbit })

// On touch devices, the gyroscope additionally nudges the reflection sheen, on
// top of (not instead of) the drag rotation. The card sums both contributions.
const isTouchDevice = window.matchMedia('(pointer: coarse)').matches

if (isTouchDevice && GyroscopeTilt.isSupported()) {
  const enableGyroscope = () => {
    GyroscopeTilt.requestPermission().then((granted) => {
      if (granted) {
        new GyroscopeTilt({ onChange: handleGyroscopeTilt })
      }
      // If denied, touch+drag alone remains active — nothing more to wire up.
    })
  }
  // iOS only grants access to orientation events from within a user gesture.
  window.addEventListener('pointerdown', enableGyroscope, { once: true })
}
