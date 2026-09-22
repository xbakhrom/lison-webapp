import { useEffect, useRef, useState } from 'react'
import { World } from '../engine/world'
import { t } from '../i18n'
import type { EpisodeScene } from '../types'

type Props = {
  scene: EpisodeScene
  shadows: boolean
  paused: boolean
  onNear: (index: number | null) => void
  onReady: (world: World) => void
}

type Knob = { pointer: number; x: number; y: number }

const JOYSTICK_RANGE = 46

/**
 * Hosts the Three.js world and the touch controls. Desktop plays with WASD and
 * a mouse drag; mobile gets a virtual stick plus a drag area for the camera
 * (spec §6).
 */
export function GameCanvas({ scene, shadows, paused, onNear, onReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World | null>(null)
  const nearRef = useRef(onNear)
  const readyRef = useRef(onReady)
  const [knob, setKnob] = useState<Knob | null>(null)

  nearRef.current = onNear
  readyRef.current = onReady

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const world = new World(canvas, scene, { shadows }, (index) => nearRef.current(index))
    worldRef.current = world
    world.start()
    readyRef.current(world)
    // Dev-only handle for driving the scene from the console; Vite drops this
    // branch from the production bundle.
    if (import.meta.env.DEV) (window as unknown as { __temurWorld?: World }).__temurWorld = world

    const observer = new ResizeObserver(() => world.resize())
    observer.observe(canvas)
    const onVisibility = () => (document.hidden ? world.stop() : world.start())
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      observer.disconnect()
      world.dispose()
      worldRef.current = null
    }
    // The world is rebuilt only when the episode scene itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene])

  useEffect(() => {
    worldRef.current?.setShadows(shadows)
  }, [shadows])

  useEffect(() => {
    worldRef.current?.setPaused(paused)
    if (paused) setKnob(null)
  }, [paused])

  // ------------------------------------------------------------- camera drag
  const lookPointer = useRef<{ id: number; x: number } | null>(null)

  const startLook = (event: React.PointerEvent) => {
    if (paused) return
    lookPointer.current = { id: event.pointerId, x: event.clientX }
  }

  const moveLook = (event: React.PointerEvent) => {
    const active = lookPointer.current
    if (!active || active.id !== event.pointerId) return
    worldRef.current?.addLook(event.clientX - active.x)
    active.x = event.clientX
  }

  const endLook = (event: React.PointerEvent) => {
    if (lookPointer.current?.id === event.pointerId) lookPointer.current = null
  }

  // ---------------------------------------------------------------- joystick
  const stickRef = useRef<HTMLDivElement>(null)

  const updateStick = (event: React.PointerEvent) => {
    const base = stickRef.current?.getBoundingClientRect()
    if (!base) return
    const centerX = base.left + base.width / 2
    const centerY = base.top + base.height / 2
    const rawX = event.clientX - centerX
    const rawY = event.clientY - centerY
    const distance = Math.hypot(rawX, rawY) || 1
    const clamped = Math.min(distance, JOYSTICK_RANGE)
    const x = (rawX / distance) * clamped
    const y = (rawY / distance) * clamped
    setKnob({ pointer: event.pointerId, x, y })
    worldRef.current?.setMove(x / JOYSTICK_RANGE, y / JOYSTICK_RANGE)
  }

  const releaseStick = (event: React.PointerEvent) => {
    if (knob && knob.pointer !== event.pointerId) return
    setKnob(null)
    worldRef.current?.setMove(0, 0)
  }

  return (
    <div className="tm-stage">
      <canvas
        ref={canvasRef}
        className="tm-canvas"
        onPointerDown={startLook}
        onPointerMove={moveLook}
        onPointerUp={endLook}
        onPointerCancel={endLook}
        onPointerLeave={endLook}
      />
      {!paused && (
        <div
          ref={stickRef}
          className={`tm-joystick ${knob ? 'is-active' : ''}`}
          aria-label={t('controls.joystick')}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            updateStick(event)
          }}
          onPointerMove={(event) => knob?.pointer === event.pointerId && updateStick(event)}
          onPointerUp={releaseStick}
          onPointerCancel={releaseStick}
        >
          <span className="tm-joystick-knob" style={{ transform: `translate(${knob?.x ?? 0}px, ${knob?.y ?? 0}px)` }} />
        </div>
      )}
    </div>
  )
}
