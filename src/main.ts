import './style.css'
import { GyroscopeTilt, HolographicCard, PointerTilt } from '@/lib/holographic-card'

console.log(`Ready! Version: ${__APP_VERSION__}`)

const containerElement = document.querySelector<HTMLDivElement>('#card')
const canvas = document.querySelector<HTMLCanvasElement>('#card-canvas')

if (!containerElement || !canvas) {
  throw new Error('Could not find the card elements')
}

const container = containerElement

const card = new HolographicCard(canvas, {
  shapeTextureUrl: `${import.meta.env.BASE_URL}shape.png`,
  goldTextureUrl: `${import.meta.env.BASE_URL}gold.png`,
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

const RAD_TO_DEG = 180 / Math.PI

// Drag rotates the card visually (CSS transform) and drives the shader.
function handleDragTilt(tiltX: number, tiltY: number) {
  card.setTilt(tiltX, tiltY)
  container.style.transform = `rotateX(${-tiltY * RAD_TO_DEG}deg) rotateY(${tiltX * RAD_TO_DEG}deg)`
}

// Gyroscope only drives the shader's reflection: rotating the card itself
// alongside the screen would feel disorienting.
function handleGyroscopeTilt(tiltX: number, tiltY: number) {
  card.setTilt(tiltX, tiltY)
}

const isTouchDevice = window.matchMedia('(pointer: coarse)').matches

if (isTouchDevice && GyroscopeTilt.isSupported()) {
  const enableGyroscope = () => {
    GyroscopeTilt.requestPermission().then((granted) => {
      if (granted) {
        new GyroscopeTilt({ onChange: handleGyroscopeTilt })
      } else {
        new PointerTilt(container, { onChange: handleDragTilt })
      }
    })
  }
  // iOS only grants access to orientation events from within a user gesture.
  window.addEventListener('pointerdown', enableGyroscope, { once: true })
} else {
  new PointerTilt(container, { onChange: handleDragTilt })
}
