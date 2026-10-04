import { useEffect, useRef, useState } from "react"
import { Pause, Play, RotateCcw } from "lucide-react"
import * as THREE from "three"
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js"
import { CadovaLogo } from "@/components/CadovaLogo"
import { cadovaLogoContour } from "./cadovaLogoShape"
import { STORY_DURATION, chapterAt, storyChapters } from "./followupStory"

const DURATION = STORY_DURATION
const clamp = THREE.MathUtils.clamp
const ease = (value: number) => {
  const t = clamp(value, 0, 1)
  return t * t * (3 - 2 * t)
}

function cardTexture(label: string, lines: readonly string[]) {
  const canvas = document.createElement("canvas")
  canvas.width = 1024
  canvas.height = 576
  const context = canvas.getContext("2d")!
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = "#0b1020"
  context.font = "600 116px system-ui, sans-serif"
  context.fillText(label, 80, 170)
  context.fillStyle = "#e4e5ea"
  context.fillRect(80, 226, 850, 3)
  context.fillStyle = "#424756"
  context.font = "500 76px system-ui, sans-serif"
  lines.forEach((line, index) => context.fillText(line, 80, 346 + index * 104))
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function FollowupScene() {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const toggleRef = useRef<(() => void) | null>(null)
  const seekRef = useRef<((chapter: number) => void) | null>(null)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(true)
  const [finished, setFinished] = useState(false)
  const [motionAllowed, setMotionAllowed] = useState(false)
  const [activeChapter, setActiveChapter] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    const element = viewportRef.current
    if (!canvas || !element) return
    const host = element

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    } catch {
      setActiveChapter(3)
      seekRef.current = setActiveChapter
      return () => {
        seekRef.current = null
      }
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NeutralToneMapping
    renderer.toneMappingExposure = 1
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-3.2, 3.2, 3, -3, 0.1, 40)
    camera.position.set(0.22, 0.25, 12)
    camera.lookAt(0.22, 0, 0)
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
      depth: 0.4,
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
    body.position.z = -0.2
    body.castShadow = true
    body.receiveShadow = true
    logo.add(body)
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.32361, 48, 32), indigo)
    dot.position.set(0.093676, -0.122583, 0.17)
    dot.castShadow = true
    world.add(dot)
    world.add(logo)

    const cardGeometry = new RoundedBoxGeometry(2.38, 1.4, 0.115, 4, 0.065)
    const faceGeometry = new THREE.PlaneGeometry(2.24, 1.28)
    const cards = [
      { label: "Client", lines: ["Coordonnées", "Notes"], focusY: 0 },
      { label: "Devis", lines: ["Envoyé", "En attente"], focusY: -0.2 },
      { label: "Relance", lines: ["À préparer", "Votre message"], focusY: -0.88 },
    ].map(({ label, lines, focusY }, index) => {
      const group = new THREE.Group()
      const card = new THREE.Mesh(cardGeometry, paper)
      card.castShadow = true
      card.receiveShadow = true
      const texture = cardTexture(label, lines)
      const face = new THREE.Mesh(
        faceGeometry,
        new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
      )
      face.position.z = 0.062
      const railMaterial = new THREE.MeshBasicMaterial({ color: "#c4c7d2" })
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 1.04, 0.012),
        railMaterial,
      )
      rail.position.set(-1.05, 0, 0.072)
      group.add(card, face, rail)
      world.add(group)
      return {
        group,
        texture,
        railMaterial,
        index,
        settled: new THREE.Vector3(1.46, 1.18 - index * 1.18, 0.18),
        path: new THREE.CubicBezierCurve3(
          new THREE.Vector3(2.2, focusY + 0.5, -1.5),
          new THREE.Vector3(1.7, focusY + 0.3, -0.75),
          new THREE.Vector3(1.3, focusY, 0.5),
          new THREE.Vector3(1.3, focusY, 0.65),
        ),
      }
    })

    const links = [0, 1].map((index) => {
      const material = new THREE.LineBasicMaterial({
        color: "#6054ff",
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
      const path = new THREE.CubicBezierCurve3(
        new THREE.Vector3(0.48, 1.18 - index * 1.18, 0.4),
        new THREE.Vector3(0.28, 1.05 - index * 1.18, 0.6),
        new THREE.Vector3(0.28, 0.13 - index * 1.18, 0.6),
        new THREE.Vector3(0.48, -index * 1.18, 0.4),
      )
      const positions = new Float32Array(49 * 3)
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage),
      )
      const line = new THREE.Line(geometry, material)
      line.frustumCulled = false
      world.add(line)
      return { line, material, path, positions }
    })
    const rest = new THREE.Vector3()
    const marker = new THREE.Vector3()
    const transitionEnd = new THREE.Vector3()
    const departureTarget = new THREE.Vector3()
    const linkPoint = new THREE.Vector3()
    const gray = new THREE.Color("#c4c7d2")
    const accent = new THREE.Color("#6054ff")

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
      new THREE.ShadowMaterial({ color: "#252a3b", opacity: 0.025 }),
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
    let lastChapter = -1
    const pointer = new THREE.Vector2()

    function updateLinks() {
      links.forEach(({ line, material, path, positions }, index) => {
        material.opacity = ease((elapsed - (index + 1) * 6 - 1.3) / 1.2) * 0.38
        const first = cards[index].group
        const second = cards[index + 1].group
        path.v0.set(
          first.position.x - first.scale.x * 1.22,
          first.position.y,
          first.position.z + 0.2,
        )
        path.v3.set(
          second.position.x - second.scale.x * 1.22,
          second.position.y,
          second.position.z + 0.2,
        )
        const left = Math.min(path.v0.x, path.v3.x) - 0.24
        path.v1.set(left, path.v0.y, 0.55)
        path.v2.set(left, path.v3.y, 0.55)
        for (let vertex = 0; vertex <= 48; vertex++) {
          path.getPoint(vertex / 48, linkPoint)
          linkPoint.toArray(positions, vertex * 3)
        }
        line.geometry.attributes.position.needsUpdate = true
      })
    }

    // Each chapter gives its dossier the foreground before revealing the full relationship.
    function pose() {
      const current = chapterAt(elapsed)
      if (current !== lastChapter) {
        lastChapter = current
        setActiveChapter(current)
      }
      const introduction = ease(elapsed / 2.2)
      const conclusion = ease((elapsed - 18) / 2.2)
      logo.position.set(-0.5 - introduction * 0.62 + conclusion * 0.14, 0.05, -0.25)
      logo.rotation.set(0.08, -0.6 + introduction * 0.36 + conclusion * 0.08, -0.025)
      logo.scale.setScalar(0.96 - introduction * 0.22 + conclusion * 0.26)

      cards.forEach(({ group, path, railMaterial, index, settled }) => {
        const arrival = ease((elapsed - index * 6 - 0.2) / 1.6)
        group.visible = arrival > 0
        path.getPoint(arrival, group.position)
        let scale = 0.72 + arrival * 0.5
        const departure = ease((elapsed - (index + 1) * 6) / 1.6)
        if (index < 2) {
          departureTarget.set(1.62, index === 0 ? 1.48 : 0.6, 0.08)
          group.position.lerp(departureTarget, departure)
          scale = THREE.MathUtils.lerp(scale, index === 0 ? 0.62 : 0.5, departure)
        }
        if (index === 0) {
          scale = THREE.MathUtils.lerp(scale, 0.5, ease((elapsed - 12) / 1.6))
        }
        group.position.lerp(settled, conclusion)
        scale = THREE.MathUtils.lerp(scale, 0.72, conclusion)
        group.scale.setScalar(scale)
        group.rotation.set(0.06, -0.3 + arrival * 0.2, (1 - arrival) * -0.1)
        const emphasis = index === Math.min(current, 2) ? arrival : 0
        railMaterial.color.copy(gray).lerp(accent, emphasis)

        if (current === index) {
          marker.set(
            group.position.x - 1.22 * scale,
            group.position.y,
            group.position.z + 0.3,
          )
        }
      })

      updateLinks()
      rest
        .set(0.093676, -0.122583, 0.17)
        .multiplyScalar(logo.scale.x)
        .applyEuler(logo.rotation)
        .add(logo.position)
      if (current === 0) {
        const outbound = ease((elapsed - 1.4) / 1.6)
        dot.position.copy(rest).lerp(marker, outbound)
        dot.position.z += Math.sin(outbound * Math.PI) * 0.35
      } else if (current < 3) {
        const progress = ease((elapsed - current * 6 - 0.4) / 2)
        links[current - 1].path.getPoint(progress, dot.position)
        dot.position.z += 0.1
      } else {
        const relance = cards[2].group
        transitionEnd.set(
          relance.position.x - 1.22 * relance.scale.x,
          relance.position.y,
          relance.position.z + 0.3,
        )
        dot.position.copy(transitionEnd).lerp(rest, ease((elapsed - 20.8) / 1.8))
      }
      dot.scale.setScalar(
        THREE.MathUtils.lerp(
          0.52,
          1,
          current === 0
            ? 1 - ease((elapsed - 1.4) / 1.6)
            : current === 3
              ? ease((elapsed - 20.8) / 1.8)
              : 0,
        ),
      )
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
      const viewHeight = Math.max(4.65, 5.45 / aspect)
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

    seekRef.current = (chapter) => {
      elapsed = chapter === 3 ? 23 : storyChapters[chapter].start + 3.2
      if (reducedMotion.matches) running = false
      setFinished(false)
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
      seekRef.current = null
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
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
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
      <div
        ref={viewportRef}
        className="absolute inset-x-0 top-0 bottom-[116px] md:bottom-[124px]"
      >
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
      </div>
      <div className="absolute inset-x-4 bottom-3 md:inset-x-6 md:bottom-5">
        <div className="flex min-h-[48px] items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-6 text-ink">
              {storyChapters[activeChapter].title}
            </h2>
            <p className="text-sm leading-5 text-ink-soft">
              {storyChapters[activeChapter].detail}
            </p>
          </div>
          {ready && motionAllowed && (
            <button
              type="button"
              onClick={() => toggleRef.current?.()}
              aria-label={controlLabel}
              title={controlLabel}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-background/90 text-ink-soft transition-colors hover:border-line-strong hover:text-primary"
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
        <nav aria-label="Parcours du dossier" className="mt-2 grid grid-cols-4 gap-2">
          {storyChapters.map((chapter, index) => (
            <button
              type="button"
              key={chapter.label}
              aria-pressed={activeChapter === index}
              onClick={() => seekRef.current?.(index)}
              className={`min-h-11 border-b-2 px-1 text-sm font-medium transition-colors ${activeChapter === index ? "border-primary text-primary" : "border-line text-muted hover:border-line-strong hover:text-ink"}`}
            >
              {chapter.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
