import { useEffect, useRef } from "react"
import * as THREE from "three"

export function FollowupScene() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100)
    camera.position.set(0, 0.35, 7.4)

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace

    const group = new THREE.Group()
    scene.add(group)

    const primary = new THREE.MeshStandardMaterial({
      color: "#4f52e8",
      roughness: 0.42,
      metalness: 0.28,
    })
    const ink = new THREE.MeshStandardMaterial({
      color: "#0b1020",
      roughness: 0.55,
      metalness: 0.18,
    })
    const paper = new THREE.MeshStandardMaterial({
      color: "#f6f6f2",
      roughness: 0.78,
      metalness: 0.02,
    })
    const line = new THREE.MeshStandardMaterial({
      color: "#c4c7d2",
      roughness: 0.7,
      metalness: 0.08,
    })

    const core = new THREE.Mesh(
      new THREE.TorusGeometry(1.12, 0.18, 28, 96, Math.PI * 1.55),
      primary,
    )
    core.rotation.set(0.2, -0.52, -0.1)
    group.add(core)

    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 36, 36), ink)
    dot.position.set(0.7, 0.3, 0.18)
    group.add(dot)

    const orbit = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.012, 10, 140), line)
    orbit.rotation.set(1.32, 0.12, 0.08)
    group.add(orbit)

    for (const card of [
      { x: -1.95, y: 1.1, z: -0.7, rx: -0.08, ry: 0.45, s: 0.76 },
      { x: 1.95, y: -0.82, z: -0.52, rx: 0.08, ry: -0.42, s: 0.86 },
      { x: -1.25, y: -1.42, z: 0.28, rx: 0.12, ry: 0.28, s: 0.62 },
    ]) {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.35 * card.s, 0.78 * card.s, 0.035),
        paper,
      )
      body.position.set(card.x, card.y, card.z)
      body.rotation.set(card.rx, card.ry, card.x > 0 ? -0.08 : 0.08)
      group.add(body)

      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.92 * card.s, 0.045, 0.042),
        primary,
      )
      rail.position.set(card.x, card.y + 0.17 * card.s, card.z + 0.035)
      rail.rotation.copy(body.rotation)
      group.add(rail)

      const second = new THREE.Mesh(
        new THREE.BoxGeometry(0.62 * card.s, 0.035, 0.044),
        line,
      )
      second.position.set(
        card.x - 0.12 * card.s,
        card.y - 0.08 * card.s,
        card.z + 0.036,
      )
      second.rotation.copy(body.rotation)
      group.add(second)
    }

    const light = new THREE.DirectionalLight("#ffffff", 3.4)
    light.position.set(2.8, 4, 5)
    scene.add(light)
    scene.add(new THREE.AmbientLight("#ffffff", 1.5))

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false)
      camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height)
      camera.updateProjectionMatrix()
    }

    let frame = 0
    const render = () => {
      if (!reducedMotion.matches) group.rotation.y += 0.0035
      group.rotation.x = Math.sin(Date.now() * 0.00035) * 0.035
      renderer.render(scene, camera)
      frame = window.requestAnimationFrame(render)
    }

    resize()
    window.addEventListener("resize", resize)
    render()

    return () => {
      window.removeEventListener("resize", resize)
      window.cancelAnimationFrame(frame)
      renderer.dispose()
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose()
      })
      primary.dispose()
      ink.dispose()
      paper.dispose()
      line.dispose()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  )
}
