import {
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  Clock,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  RingGeometry,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from 'three'
import type { EpisodeScene, SceneProp } from '../types'

export type StationState = 'empty' | 'normal' | 'exception'

type Solid = { minX: number; maxX: number; minZ: number; maxZ: number }

type Station = {
  group: Group
  core: Mesh
  ring: Mesh
  star: Sprite
  state: StationState
  home: Vector3
  /** Counts down while the solved animation plays. */
  flight: { target: Vector3; time: number } | null
}

const PLAYER_RADIUS = 0.45
const INTERACT_RADIUS = 2.1
const WALK_SPEED = 5.2

/**
 * The 3D layer. Everything it renders comes from the episode's `scene` block,
 * so a new episode is a new JSON file rather than new code (spec §7).
 */
export class World {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera: PerspectiveCamera
  private readonly clock = new Clock()
  private readonly player = new Group()
  private readonly cat = new Group()
  private readonly stations: Station[] = []
  private readonly zones = new Map<string, Vector3>()
  private readonly solids: Solid[] = []
  private readonly bounds: [number, number]
  private readonly keys = new Set<string>()
  private readonly disposables: { dispose(): void }[] = []

  private readonly move = { x: 0, z: 0 }
  // Scenes are laid out with their content towards -z, so the camera starts
  // behind the player looking into the room.
  private yaw = Math.PI
  private facing = Math.PI
  private bob = 0
  private near: number | null = null
  private frame = 0
  private running = false
  private paused = false
  private sun: DirectionalLight

  constructor(
    private readonly canvas: HTMLCanvasElement,
    config: EpisodeScene,
    options: { shadows: boolean },
    private readonly onNear: (index: number | null) => void,
  ) {
    this.bounds = config.bounds
    this.renderer = new WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 2, powerPreference: 'low-power' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.type = PCFSoftShadowMap
    this.renderer.shadowMap.enabled = options.shadows

    this.scene.background = new Color(config.sky)
    this.scene.fog = new Fog(new Color(config.fog).getHex(), 18, 52)

    this.camera = new PerspectiveCamera(58, 1, 0.1, 90)

    const ambient = new HemisphereLight(new Color(config.sky).getHex(), new Color(config.ground).getHex(), 1.5)
    this.scene.add(ambient)

    this.sun = new DirectionalLight(0xffffff, 1.35)
    this.sun.position.set(9, 16, 7)
    this.sun.castShadow = options.shadows
    this.sun.shadow.mapSize.set(1024, 1024)
    this.sun.shadow.camera.left = -22
    this.sun.shadow.camera.right = 22
    this.sun.shadow.camera.top = 22
    this.sun.shadow.camera.bottom = -22
    this.scene.add(this.sun)

    this.buildGround(config)
    config.props.forEach((prop) => this.buildProp(prop, options.shadows))
    config.zones.forEach((zone) => this.buildZone(zone))
    config.stations.forEach(([x, z]) => this.buildStation(x, z, options.shadows))
    this.buildPlayer(options.shadows, config.spawn)
    this.buildCat(config.spawn)

    this.resize()
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
  }

  // ---------------------------------------------------------------- building

  private track<T extends { dispose(): void }>(resource: T): T {
    this.disposables.push(resource)
    return resource
  }

  private buildGround(config: EpisodeScene): void {
    const [x, z] = config.bounds
    const geometry = this.track(new PlaneGeometry(x * 2 + 8, z * 2 + 8))
    const material = this.track(new MeshLambertMaterial({ color: new Color(config.ground) }))
    const ground = new Mesh(geometry, material)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)
  }

  private buildProp(prop: SceneProp, shadows: boolean): void {
    const [sx, sy, sz] = prop.size
    const geometry = this.track(
      prop.kind === 'box'
        ? new BoxGeometry(sx, sy, sz)
        : prop.kind === 'cylinder'
          ? new CylinderGeometry(sx / 2, sx / 2, sy, 10)
          : prop.kind === 'cone'
            ? new ConeGeometry(sx / 2, sy, 10)
            : new SphereGeometry(sx / 2, 12, 8),
    )
    const material = this.track(new MeshLambertMaterial({ color: new Color(prop.color) }))
    const mesh = new Mesh(geometry, material)
    mesh.position.set(prop.pos[0], prop.pos[1] + sy / 2, prop.pos[2])
    if (prop.rotY) mesh.rotation.y = MathUtils.degToRad(prop.rotY)
    mesh.castShadow = shadows
    mesh.receiveShadow = shadows
    this.scene.add(mesh)

    if (prop.solid) {
      this.solids.push({
        minX: prop.pos[0] - sx / 2 - PLAYER_RADIUS,
        maxX: prop.pos[0] + sx / 2 + PLAYER_RADIUS,
        minZ: prop.pos[2] - sz / 2 - PLAYER_RADIUS,
        maxZ: prop.pos[2] + sz / 2 + PLAYER_RADIUS,
      })
    }
  }

  private buildZone(zone: EpisodeScene['zones'][number]): void {
    const group = new Group()
    group.position.set(zone.pos[0], zone.pos[1], zone.pos[2])

    const body = new Mesh(
      this.track(new BoxGeometry(1.9, 1.1, 1.4)),
      this.track(new MeshLambertMaterial({ color: new Color(zone.color) })),
    )
    body.position.y = 0.75
    group.add(body)

    const rim = new Mesh(
      this.track(new TorusGeometry(1.05, 0.06, 6, 20)),
      this.track(new MeshBasicMaterial({ color: new Color(zone.color) })),
    )
    rim.rotation.x = -Math.PI / 2
    rim.position.y = 0.04
    group.add(rim)

    for (const side of [-1, 1]) {
      const wheel = new Mesh(
        this.track(new CylinderGeometry(0.22, 0.22, 0.12, 8)),
        this.track(new MeshLambertMaterial({ color: 0x2a3550 })),
      )
      wheel.rotation.z = Math.PI / 2
      wheel.position.set(side * 0.8, 0.22, 0.5)
      group.add(wheel)
    }

    // Three short labels per scene, baked once into a texture: the spec asks to
    // keep text in the DOM, but a cart has to be readable from across the room.
    group.add(this.makeLabel(zone.label, zone.color, 1.85))

    this.scene.add(group)
    this.zones.set(zone.label, new Vector3(zone.pos[0], zone.pos[1] + 1.2, zone.pos[2]))
    this.solids.push({
      minX: zone.pos[0] - 0.95 - PLAYER_RADIUS,
      maxX: zone.pos[0] + 0.95 + PLAYER_RADIUS,
      minZ: zone.pos[2] - 0.7 - PLAYER_RADIUS,
      maxZ: zone.pos[2] + 0.7 + PLAYER_RADIUS,
    })
  }

  private makeLabel(text: string, color: string, height: number): Sprite {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const context = canvas.getContext('2d')
    if (context) {
      context.fillStyle = 'rgba(255,255,255,0.94)'
      context.roundRect(0, 0, 256, 64, 18)
      context.fill()
      context.fillStyle = color
      context.font = 'bold 34px system-ui, sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(text, 128, 34, 232)
    }
    const texture = this.track(new CanvasTexture(canvas))
    const sprite = new Sprite(this.track(new SpriteMaterial({ map: texture, transparent: true, depthWrite: false })))
    sprite.scale.set(1.6, 0.4, 1)
    sprite.position.y = height
    return sprite
  }

  private buildStation(x: number, z: number, shadows: boolean): void {
    const group = new Group()
    group.position.set(x, 0, z)

    const core = new Mesh(
      this.track(new IcosahedronGeometry(0.42, 0)),
      this.track(new MeshLambertMaterial({ color: 0x2f8bff, emissive: 0x0a2f66 })),
    )
    core.position.y = 1.1
    core.castShadow = shadows
    group.add(core)

    const ring = new Mesh(
      this.track(new RingGeometry(0.72, 0.92, 22)),
      this.track(new MeshBasicMaterial({ color: 0x2f8bff, transparent: true, opacity: 0.55 })),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.03
    group.add(ring)

    // Spec §8: colour must never be the only signal — exceptions also get a star.
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const context = canvas.getContext('2d')
    if (context) {
      context.font = '48px system-ui, sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText('⭐', 32, 36)
    }
    const star = new Sprite(
      this.track(new SpriteMaterial({ map: this.track(new CanvasTexture(canvas)), transparent: true, depthWrite: false })),
    )
    star.scale.set(0.5, 0.5, 1)
    star.position.y = 1.85
    star.visible = false
    group.add(star)

    this.scene.add(group)
    this.stations.push({ group, core, ring, star, state: 'empty', home: new Vector3(x, 1.1, z), flight: null })
    group.visible = false
  }

  private buildPlayer(shadows: boolean, spawn: [number, number]): void {
    const jacket = this.track(new MeshLambertMaterial({ color: 0x2f6fd0 }))
    const skin = this.track(new MeshLambertMaterial({ color: 0xe8b98e }))

    const body = new Mesh(this.track(new CapsuleGeometry(0.32, 0.5, 4, 8)), jacket)
    body.position.y = 0.86
    body.castShadow = shadows
    this.player.add(body)

    const head = new Mesh(this.track(new SphereGeometry(0.26, 12, 10)), skin)
    head.position.y = 1.46
    head.castShadow = shadows
    this.player.add(head)

    const hair = new Mesh(this.track(new SphereGeometry(0.27, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)), this.track(new MeshLambertMaterial({ color: 0x2a2320 })))
    hair.position.y = 1.48
    this.player.add(hair)

    const bag = new Mesh(this.track(new BoxGeometry(0.44, 0.5, 0.22)), this.track(new MeshLambertMaterial({ color: 0xd8552f })))
    bag.position.set(0, 0.92, -0.34)
    bag.castShadow = shadows
    this.player.add(bag)

    const legs = new Mesh(this.track(new CapsuleGeometry(0.18, 0.34, 4, 6)), this.track(new MeshLambertMaterial({ color: 0x2b3245 })))
    legs.position.y = 0.34
    this.player.add(legs)

    this.player.position.set(spawn[0], 0, spawn[1])
    this.player.rotation.y = Math.PI
    this.scene.add(this.player)
  }

  private buildCat(spawn: [number, number]): void {
    const fur = this.track(new MeshLambertMaterial({ color: 0x9aa3b2 }))
    const body = new Mesh(this.track(new CapsuleGeometry(0.16, 0.26, 4, 6)), fur)
    body.rotation.z = Math.PI / 2
    body.position.y = 0.28
    this.cat.add(body)

    const head = new Mesh(this.track(new SphereGeometry(0.17, 10, 8)), fur)
    head.position.set(0.28, 0.42, 0)
    this.cat.add(head)

    for (const side of [-1, 1]) {
      const ear = new Mesh(this.track(new ConeGeometry(0.06, 0.13, 5)), fur)
      ear.position.set(0.28, 0.56, side * 0.08)
      this.cat.add(ear)
    }

    const tail = new Mesh(this.track(new CylinderGeometry(0.04, 0.03, 0.42, 5)), fur)
    tail.rotation.z = -Math.PI / 3
    tail.position.set(-0.32, 0.42, 0)
    this.cat.add(tail)

    this.cat.position.set(spawn[0] - 1.4, 0, spawn[1] + 0.6)
    this.scene.add(this.cat)
  }

  // ------------------------------------------------------------------- input

  private onKeyDown = (event: KeyboardEvent) => {
    this.keys.add(event.code)
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault()
  }

  private onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code)
  }

  setMove(x: number, z: number): void {
    this.move.x = MathUtils.clamp(x, -1, 1)
    this.move.z = MathUtils.clamp(z, -1, 1)
  }

  addLook(deltaX: number): void {
    this.yaw -= deltaX * 0.005
  }

  /** While a task panel is open the character holds still but the scene keeps
   *  breathing behind it. */
  setPaused(paused: boolean): void {
    this.paused = paused
    if (paused) {
      this.move.x = 0
      this.move.z = 0
      this.keys.clear()
    }
  }

  setShadows(enabled: boolean): void {
    this.renderer.shadowMap.enabled = enabled
    this.sun.castShadow = enabled
    this.scene.traverse((object) => {
      if (object instanceof Mesh && object.geometry instanceof PlaneGeometry) object.receiveShadow = enabled
    })
  }

  // ------------------------------------------------------------------ states

  get stationCount(): number {
    return this.stations.length
  }

  /** Used to spawn the next task away from the player, so the episode is walked
   *  rather than answered from one spot. */
  distanceToPlayer(index: number): number {
    const station = this.stations[index]
    if (!station) return 0
    return Math.hypot(station.home.x - this.player.position.x, station.home.z - this.player.position.z)
  }

  setStation(index: number, state: StationState): void {
    const station = this.stations[index]
    if (!station) return
    station.state = state
    station.flight = null
    station.group.visible = state !== 'empty'
    station.group.position.set(station.home.x, 0, station.home.z)
    station.core.position.set(0, 1.1, 0)
    station.core.scale.setScalar(1)
    station.star.visible = state === 'exception'
    const color = state === 'exception' ? 0xffc02e : 0x2f8bff
    const emissive = state === 'exception' ? 0x6b4a00 : 0x0a2f66
    ;(station.core.material as MeshLambertMaterial).color.setHex(color)
    ;(station.core.material as MeshLambertMaterial).emissive.setHex(emissive)
    ;(station.ring.material as MeshBasicMaterial).color.setHex(color)
    if (this.near === index) this.emitNear(null)
  }

  /** Sends the solved object to the matching cart, or pops it where it stands. */
  solveStation(index: number, zoneLabel?: string): void {
    const station = this.stations[index]
    if (!station) return
    const target = (zoneLabel && this.zones.get(zoneLabel)) || station.home.clone().setY(2.4)
    station.flight = { target: target.clone(), time: 0 }
  }

  private emitNear(index: number | null): void {
    if (this.near === index) return
    this.near = index
    this.onNear(index)
  }

  // ------------------------------------------------------------------- frame

  start(): void {
    if (this.running) return
    this.running = true
    this.clock.start()
    this.frame = requestAnimationFrame(this.tick)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.frame)
  }

  resize(): void {
    const width = this.canvas.clientWidth || 1
    const height = this.canvas.clientHeight || 1
    this.renderer.setSize(width, height, false)
    const aspect = width / height
    this.camera.aspect = aspect
    // A tall phone viewport cuts the horizontal field of view, so widen the
    // lens rather than leaving the player staring at their own back.
    this.camera.fov = aspect < 1 ? Math.min(72, 55 / Math.max(0.55, aspect)) : 55
    this.camera.updateProjectionMatrix()
  }

  private readKeyboard(): { x: number; z: number } {
    if (this.paused) return { x: 0, z: 0 }
    let x = this.move.x
    let z = this.move.z
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z -= 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z += 1
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1
    const length = Math.hypot(x, z)
    return length > 1 ? { x: x / length, z: z / length } : { x, z }
  }

  private movePlayer(delta: number): void {
    const input = this.readKeyboard()
    const moving = Math.hypot(input.x, input.z) > 0.05
    if (moving) {
      // Movement is relative to the camera: forward is where it looks, right is
      // what the player sees on the right of the screen.
      const forward = { x: Math.sin(this.yaw), z: Math.cos(this.yaw) }
      const right = { x: -Math.cos(this.yaw), z: Math.sin(this.yaw) }
      const dx = (right.x * input.x - forward.x * input.z) * WALK_SPEED * delta
      const dz = (right.z * input.x - forward.z * input.z) * WALK_SPEED * delta

      const next = this.player.position.clone()
      next.x += dx
      this.resolve(next, 'x', this.player.position.z)
      next.z += dz
      this.resolve(next, 'z', next.x)

      this.player.position.x = MathUtils.clamp(next.x, -this.bounds[0], this.bounds[0])
      this.player.position.z = MathUtils.clamp(next.z, -this.bounds[1], this.bounds[1])
      this.facing = Math.atan2(dx, dz)
      this.bob += delta * 11
    } else {
      this.bob += delta * 2
    }

    this.player.rotation.y = MathUtils.lerp(this.player.rotation.y, this.facing, 0.22)
    this.player.position.y = moving ? Math.abs(Math.sin(this.bob)) * 0.06 : 0
  }

  /** Pushes the player back out of any solid prop it just walked into. */
  private resolve(position: Vector3, axis: 'x' | 'z', other: number): void {
    for (const solid of this.solids) {
      const insideX = axis === 'x' ? position.x > solid.minX && position.x < solid.maxX : other > solid.minX && other < solid.maxX
      const insideZ = axis === 'z' ? position.z > solid.minZ && position.z < solid.maxZ : other > solid.minZ && other < solid.maxZ
      if (!insideX || !insideZ) continue
      if (axis === 'x') {
        position.x = position.x > (solid.minX + solid.maxX) / 2 ? solid.maxX : solid.minX
      } else {
        position.z = position.z > (solid.minZ + solid.maxZ) / 2 ? solid.maxZ : solid.minZ
      }
    }
  }

  private updateStations(delta: number, time: number): void {
    let closest: number | null = null
    let closestDistance = INTERACT_RADIUS

    this.stations.forEach((station, index) => {
      if (station.state === 'empty') return

      if (station.flight) {
        station.flight.time += delta * 1.8
        const progress = Math.min(1, station.flight.time)
        const from = station.home
        station.core.position.set(
          MathUtils.lerp(0, station.flight.target.x - from.x, progress),
          MathUtils.lerp(1.1, station.flight.target.y, progress) + Math.sin(progress * Math.PI) * 1.2,
          MathUtils.lerp(0, station.flight.target.z - from.z, progress),
        )
        station.core.scale.setScalar(1 - progress * 0.9)
        ;(station.ring.material as MeshBasicMaterial).opacity = 0.55 * (1 - progress)
        if (progress >= 1) this.setStation(index, 'empty')
        return
      }

      station.core.rotation.y += delta * 1.2
      station.core.rotation.x += delta * 0.6
      station.core.position.y = 1.1 + Math.sin(time * 2 + index) * 0.12
      const pulse = 0.45 + Math.abs(Math.sin(time * 2.2 + index)) * 0.35
      ;(station.ring.material as MeshBasicMaterial).opacity = pulse

      const distance = Math.hypot(
        station.group.position.x - this.player.position.x,
        station.group.position.z - this.player.position.z,
      )
      if (distance < closestDistance) {
        closestDistance = distance
        closest = index
      }
    })

    this.emitNear(closest)
  }

  private updateCat(delta: number, time: number): void {
    const behind = new Vector3(
      this.player.position.x - Math.sin(this.player.rotation.y) * 1.25 + 0.6,
      0,
      this.player.position.z - Math.cos(this.player.rotation.y) * 1.25,
    )
    this.cat.position.lerp(behind, Math.min(1, delta * 3))
    this.cat.rotation.y = MathUtils.lerp(this.cat.rotation.y, this.player.rotation.y + Math.PI / 2, 0.1)
    this.cat.position.y = Math.abs(Math.sin(time * 6)) * 0.05
  }

  private updateCamera(delta: number): void {
    const distance = 6.8
    // The camera may leave the walkable area but not the room: scenes keep
    // their walls at least this far outside the player's bounds.
    const limitX = this.bounds[0] + 1.6
    const limitZ = this.bounds[1] + 1.8
    const target = new Vector3(
      MathUtils.clamp(this.player.position.x - Math.sin(this.yaw) * distance, -limitX, limitX),
      4,
      MathUtils.clamp(this.player.position.z - Math.cos(this.yaw) * distance, -limitZ, limitZ),
    )
    this.camera.position.lerp(target, Math.min(1, delta * 6))
    this.camera.lookAt(this.player.position.x, 1.2, this.player.position.z)
  }

  private tick = () => {
    if (!this.running) return
    this.frame = requestAnimationFrame(this.tick)
    const delta = Math.min(0.05, this.clock.getDelta())
    const time = this.clock.elapsedTime

    this.movePlayer(delta)
    this.updateStations(delta, time)
    this.updateCat(delta, time)
    this.updateCamera(delta)
    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    this.stop()
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    this.disposables.forEach((resource) => resource.dispose())
    this.disposables.length = 0
    this.renderer.dispose()
  }
}
