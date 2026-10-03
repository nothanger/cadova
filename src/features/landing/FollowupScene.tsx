import { useEffect, useRef, useState } from "react"
import { Pause, Play, RotateCcw } from "lucide-react"
import * as THREE from "three"
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js"
import { CadovaLogo } from "@/components/CadovaLogo"
import { cadovaLogoContour } from "./cadovaLogoShape"

const DURATION = 9
const clamp = THREE.MathUtils.clamp
const ease = (value: number) => {
  const t = clamp(value, 0, 1)
  return t * t * (3 - 2 * t)
}

function cardTexture(label: string) {
  const canvas = document.createElement("canvas")
  canvas.width = 768
  canvas.height = 320
  const context = canvas.getContext("2d")!
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = "#0b1020"
  context.font = "600 64px system-ui, sans-serif"
  context.fillText(label, 70, 128)
  context.fillStyle = "#e4e5ea"
  context.fillRect(70, 181, 430, 14)
  context.fillRect(70, 222, 290, 14)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function FollowupScene() {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const toggleRef = useRef<(() => void) | null>(null)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(true)
  const [finished, setFinished] = useState(false)
  const [motionAllowed, setMotionAllowed] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const element = hostRef.current
    if (!canvas || !element) return
    const host = element

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    } catch {
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NeutralToneMapping
    renderer.toneMappingExposure = 1
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-3.2, 3.2, 3, -3, 0.1, 40)
    camera.position.set(0, 0.35, 12)
    camera.lookAt(0, 0, 0)
    function makeEnvironment() {
      const room = new RoomEnvironment()
      const pmrem = new THREE.PMREMGenerator(renderer)
      const target = pmrem.fromScene(room, 0.04, 0.1, 100, { size: 64 })
      room.dispose()
      pmrem.dispose()
      return target
    }
    let environment = makeEnvironment()
    scene.environment = environment.texture

    const world = new THREE.Group()
    scene.add(world)
    const ink = new THREE.MeshPhysicalMaterial({
      color: "#0b1020",
      roughness: 0.4,
      metalness: 0.14,
      clearcoat: 0.2,
      clearcoatRoughness: 0.24,
    })
    const indigo = new THREE.MeshPhysicalMaterial({
      color: "#6054ff",
      roughness: 0.34,
      metalness: 0.04,
      clearcoat: 0.3,
      envMapIntensity: 0.6,
    })
    const paper = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      roughness: 0.48,
      metalness: 0.05,
    })

    const logo = new THREE.Group()
    logo.position.set(-0.82, 0.08, 0)
    const shape = new THREE.Shape(
      cadovaLogoContour.map(([x, y]) => new THREE.Vector2(x, y)),
    )
    const extrusion = new THREE.ExtrudeGeometry(shape, {
      depth: 0.32,
      bevelEnabled: true,
      bevelThickness: 0.055,
      bevelSize: 0.045,
      bevelSegments: 5,
      steps: 1,
    })
    extrusion.deleteAttribute("normal")
    const bodyGeometry = mergeVertices(extrusion)
    bodyGeometry.computeVertexNormals()
    extrusion.dispose()
    const body = new THREE.Mesh(bodyGeometry, ink)
    body.position.z = -0.16
    body.castShadow = true
    body.receiveShadow = true
    logo.add(body)
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.32361, 48, 32), indigo)
    dot.position.set(0.093676, -0.122583, 0.17)
    dot.castShadow = true
    logo.add(dot)
    world.add(logo)

    const cardGeometry = new RoundedBoxGeometry(1.67, 0.74, 0.09, 4, 0.065)
    const faceGeometry = new THREE.PlaneGeometry(1.52, 0.63)
    const cards = [
      { label: "Clients", start: [-1.92, 1.77, -0.65], y: 0.89, tilt: -0.2 },
      { label: "Devis", start: [1.81, 1.7, -0.32], y: 0, tilt: 0.18 },
      { label: "Relances", start: [0.68, -1.6, 0.45], y: -0.89, tilt: -0.15 },
    ].map(({ label, start, y, tilt }, index) => {
      const group = new THREE.Group()
      const card = new THREE.Mesh(cardGeometry, paper)
      card.castShadow = true
      card.receiveShadow = true
      const texture = cardTexture(label)
      const face = new THREE.Mesh(
        faceGeometry,
        new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
      )
      face.position.z = 0.049
      const railMaterial = new THREE.MeshBasicMaterial({ color: "#c4c7d2" })
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.48, 0.012),
        railMaterial,
      )
      rail.position.set(-0.72, 0, 0.057)
      group.add(card, face, rail)
      world.add(group)
      return {
        group,
        texture,
        railMaterial,
        tilt,
        index,
        path: new THREE.CubicBezierCurve3(
          new THREE.Vector3(...(start as [number, number, number])),
          new THREE.Vector3(start[0] * 0.4, start[1] * 0.65, -0.9),
          new THREE.Vector3(0.55, y + 0.2, -0.18),
          new THREE.Vector3(1.68, y, 0.15),
        ),
      }
    })

    const actionPath = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0.093676, -0.122583, 0.17),
      new THREE.Vector3(0.92, -0.05, 0.75),
      new THREE.Vector3(1.3, -0.85, 0.75),
      new THREE.Vector3(1.69, -0.97, 0.6),
    )
    const actionMaterial = new THREE.MeshBasicMaterial({
      color: "#6054ff",
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    const actionLine = new THREE.Mesh(
      new THREE.TubeGeometry(actionPath, 56, 0.012, 6, false),
      actionMaterial,
    )
    logo.add(actionLine)

    const key = new THREE.DirectionalLight("#ffffff", 3.6)
    key.position.set(-3, 6, 6)
    key.castShadow = true
    key.shadow.mapSize.set(512, 512)
    key.shadow.camera.left = -5
    key.shadow.camera.right = 5
    key.shadow.camera.top = 5
    key.shadow.camera.bottom = -5
    key.shadow.normalBias = 0.025
    key.shadow.bias = -0.0004
    key.shadow.radius = 4
    scene.add(key)
    const rim = new THREE.DirectionalLight("#d9dcff", 2)
    rim.position.set(4, 2, -3)
    scene.add(rim, new THREE.HemisphereLight("#ffffff", "#a1a5b4", 1.1))
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.ShadowMaterial({ color: "#252a3b", opacity: 0.045 }),
    )
    floor.position.z = -0.58
    floor.receiveShadow = true
    scene.add(floor)

    let elapsed = reducedMotion.matches ? DURATION : 0
    let running = !reducedMotion.matches
    let visible = true
    let contextLost = false
    let frame = 0
    let previousTime = 0
    const pointer = new THREE.Vector2()

    // Dispersed dossiers align in order; the logo point then marks the next action.
    function pose() {
      logo.rotation.set(0.09, -0.62 + ease(elapsed / 2.2) * 0.42, -0.025)
      const entrance = 0.92 + ease(elapsed / 1.8) * 0.08
      logo.scale.setScalar(entrance)
      cards.forEach(({ group, path, tilt, railMaterial, index }) => {
        const progress = ease((elapsed - 1.1 - index * 0.78) / 2.45)
        path.getPoint(progress, group.position)
        group.rotation.set(
          THREE.MathUtils.lerp(0.14, 0.04, progress),
          THREE.MathUtils.lerp(index === 0 ? 0.38 : -0.34, -0.16, progress),
          tilt * (1 - progress),
        )
        railMaterial.color.set(index === 2 && elapsed > 6.2 ? "#6054ff" : "#c4c7d2")
      })
      const outbound = ease((elapsed - 5.3) / 1.15)
      const inbound = ease((elapsed - 7) / 1.25)
      const travel = outbound * (1 - inbound)
      actionPath.getPoint(travel, dot.position)
      dot.scale.setScalar(1 - travel * 0.55)
      actionMaterial.opacity = Math.sin(travel * Math.PI) * 0.3
      world.rotation.set(pointer.y * 0.045, pointer.x * 0.07, 0)
    }

    function draw() {
      if (contextLost) return
      pose()
      renderer.render(scene, camera)
    }

    function stopFrame() {
      window.cancelAnimationFrame(frame)
      frame = 0
      previousTime = 0
    }

    function tick(now: number) {
      frame = 0
      if (!running || !visible || document.hidden || contextLost) return
      if (previousTime)
        elapsed = Math.min(DURATION, elapsed + (now - previousTime) / 1000)
      previousTime = now
      draw()
      if (elapsed >= DURATION) {
        running = false
        setPlaying(false)
        setFinished(true)
        previousTime = 0
      } else {
        frame = window.requestAnimationFrame(tick)
      }
    }

    function resume() {
      if (running && visible && !document.hidden && !contextLost && !frame) {
        frame = window.requestAnimationFrame(tick)
      }
    }

    function resize() {
      const { width, height } = host.getBoundingClientRect()
      if (!width || !height) return
      renderer.setSize(width, height, false)
      const aspect = width / height
      const viewHeight = Math.max(5.35, 6.15 / aspect)
      camera.left = (-viewHeight * aspect) / 2
      camera.right = (viewHeight * aspect) / 2
      camera.top = viewHeight / 2
      camera.bottom = -viewHeight / 2
      camera.updateProjectionMatrix()
      draw()
    }

    function motionChange() {
      running = !reducedMotion.matches
      elapsed = reducedMotion.matches ? DURATION : 0
      pointer.set(0, 0)
      stopFrame()
      setMotionAllowed(!reducedMotion.matches)
      setPlaying(running)
      setFinished(reducedMotion.matches)
      draw()
      resume()
    }

    function visibilityChange() {
      stopFrame()
      resume()
    }

    function move(event: PointerEvent) {
      if (reducedMotion.matches || event.pointerType === "touch") return
      const rect = host.getBoundingClientRect()
      pointer.set(
        clamp(((event.clientX - rect.left) / rect.width - 0.5) * 2, -1, 1),
        clamp(((event.clientY - rect.top) / rect.height - 0.5) * 2, -1, 1),
      )
      if (!running) draw()
    }

    function leave() {
      pointer.set(0, 0)
      if (!running) draw()
    }

    function loseContext(event: Event) {
      event.preventDefault()
      contextLost = true
      stopFrame()
      setReady(false)
    }

    function restoreContext() {
      contextLost = false
      environment.dispose()
      environment = makeEnvironment()
      scene.environment = environment.texture
      resize()
      setReady(true)
      resume()
    }

    toggleRef.current = () => {
      if (reducedMotion.matches) return
      if (elapsed >= DURATION) {
        elapsed = 0
        setFinished(false)
      }
      running = !running
      setPlaying(running)
      stopFrame()
      draw()
      resume()
    }

    const observer = new ResizeObserver(resize)
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      stopFrame()
      resume()
    })
    observer.observe(host)
    intersection.observe(host)
    reducedMotion.addEventListener("change", motionChange)
    document.addEventListener("visibilitychange", visibilityChange)
    host.addEventListener("pointermove", move)
    host.addEventListener("pointerleave", leave)
    canvas.addEventListener("webglcontextlost", loseContext)
    canvas.addEventListener("webglcontextrestored", restoreContext)
    motionChange()
    resize()
    setReady(true)

    return () => {
      toggleRef.current = null
      stopFrame()
      observer.disconnect()
      intersection.disconnect()
      reducedMotion.removeEventListener("change", motionChange)
      document.removeEventListener("visibilitychange", visibilityChange)
      host.removeEventListener("pointermove", move)
      host.removeEventListener("pointerleave", leave)
      canvas.removeEventListener("webglcontextlost", loseContext)
      canvas.removeEventListener("webglcontextrestored", restoreContext)
      const geometries = new Set<THREE.BufferGeometry>()
      const materials = new Set<THREE.Material>()
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          geometries.add(object.geometry)
          const list = Array.isArray(object.material)
            ? object.material
            : [object.material]
          list.forEach((material) => materials.add(material))
        }
      })
      geometries.forEach((geometry) => geometry.dispose())
      materials.forEach((material) => material.dispose())
      cards.forEach(({ texture }) => texture.dispose())
      key.shadow.dispose()
      environment.dispose()
      renderer.dispose()
    }
  }, [])

  const controlLabel = playing
    ? "Mettre l’animation en pause"
    : finished
      ? "Rejouer l’animation"
      : "Reprendre l’animation"

  return (
    <div ref={hostRef} className="relative h-full w-full">
      {!ready && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <CadovaLogo className="h-12" alt="" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`}
      />
      {ready && motionAllowed && (
        <button
          type="button"
          onClick={() => toggleRef.current?.()}
          aria-label={controlLabel}
          title={controlLabel}
          className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-background/90 text-ink-soft transition-colors hover:border-line-strong hover:text-primary md:bottom-8 md:right-8"
        >
          {playing ? (
            <Pause size={17} />
          ) : finished ? (
            <RotateCcw size={17} />
          ) : (
            <Play size={17} />
          )}
        </button>
      )}
    </div>
  )
}
