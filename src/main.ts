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
  shapeTextureUrl: '/shape.png',
  goldTextureUrl: '/gold.png',
})

function resize() {
  const { width, height } = container.getBoundingClientRect()
  card.resize(width, height)
}

window.addEventListener('resize', resize)
resize()
card.start()

const RAD_TO_DEG = 180 / Math.PI

function handleTilt(tiltX: number, tiltY: number) {
  card.setTilt(tiltX, tiltY)
  container.style.transform = `rotateX(${-tiltY * RAD_TO_DEG}deg) rotateY(${tiltX * RAD_TO_DEG}deg)`
}

const isTouchDevice = window.matchMedia('(pointer: coarse)').matches

if (isTouchDevice && GyroscopeTilt.isSupported()) {
  const enableGyroscope = () => {
    GyroscopeTilt.requestPermission().then((granted) => {
      if (granted) {
        new GyroscopeTilt({ onChange: handleTilt })
      } else {
        new PointerTilt(container, { onChange: handleTilt })
      }
    })
  }
  // iOS only grants access to orientation events from within a user gesture.
  window.addEventListener('pointerdown', enableGyroscope, { once: true })
} else {
  new PointerTilt(container, { onChange: handleTilt })
}
