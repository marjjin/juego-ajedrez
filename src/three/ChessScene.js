import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { createPiece } from './pieces.js'

const FILES = 'abcdefgh'
const START_BOARD = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'

export function squareToXZ(sq) {
  const f = FILES.indexOf(sq[0])
  const r = Number(sq[1]) - 1
  return [f - 3.5, 3.5 - r]
}

function xzToSquare(x, z) {
  const f = Math.floor(x + 4)
  const r = Math.floor(4 - z)
  if (f < 0 || f > 7 || r < 0 || r > 7) return null
  return FILES[f] + (r + 1)
}

/** "rnbqkbnr/..." -> Map(square -> 'wp' | 'bk' ...) */
function parseBoard(fen) {
  const map = new Map()
  const rows = fen.split(' ')[0].split('/')
  rows.forEach((row, i) => {
    const rank = 8 - i
    let f = 0
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch)
      else {
        const color = ch === ch.toUpperCase() ? 'w' : 'b'
        map.set(FILES[f] + rank, color + ch.toLowerCase())
        f++
      }
    }
  })
  return map
}

function woodTexture(base, grain, seed = 1) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 256, 256)
  let s = seed
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  ctx.strokeStyle = grain
  for (let i = 0; i < 70; i++) {
    ctx.globalAlpha = 0.05 + rnd() * 0.12
    ctx.lineWidth = 0.5 + rnd() * 2
    const y0 = rnd() * 256
    const amp = 2 + rnd() * 6
    const freq = 0.01 + rnd() * 0.03
    ctx.beginPath()
    for (let x = 0; x <= 256; x += 8) {
      const y = y0 + Math.sin(x * freq + i) * amp
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

function labelTexture(text, color) {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')
  ctx.fillStyle = color
  ctx.font = '600 40px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 32, 34)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

export class ChessScene {
  constructor(container) {
    this.container = container
    this.pieces = new Map() // square -> Group
    this.boardMap = new Map()
    this.tweens = []
    this.selected = null
    this.targets = []
    this.interactive = false
    this.handlers = {}
    this.orientation = 'w'

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    container.appendChild(renderer.domElement)
    this.renderer = renderer

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x14161b)
    scene.fog = new THREE.Fog(0x14161b, 18, 34)
    this.scene = scene

    const pmrem = new THREE.PMREMGenerator(renderer)
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = this.envTexture
    scene.environmentIntensity = 0.35
    pmrem.dispose()

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    this.camera.position.set(0, 10.5, 10)

    const controls = new OrbitControls(this.camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = false
    controls.minDistance = 7
    controls.maxDistance = 22
    controls.maxPolarAngle = 1.32
    controls.autoRotateSpeed = 0.5
    controls.target.set(0, 0, 0)
    this.controls = controls

    const hemi = new THREE.HemisphereLight(0xfff1dc, 0x1a1c24, 0.7)
    scene.add(hemi)
    const sun = new THREE.DirectionalLight(0xfff3e2, 2.4)
    sun.position.set(6, 13, 5)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -7
    sun.shadow.camera.right = 7
    sun.shadow.camera.top = 7
    sun.shadow.camera.bottom = -7
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 40
    sun.shadow.bias = -0.0004
    sun.shadow.normalBias = 0.02
    scene.add(sun)
    const rim = new THREE.DirectionalLight(0x9db4ff, 0.6)
    rim.position.set(-8, 6, -6)
    scene.add(rim)

    this.materials = {
      white: new THREE.MeshStandardMaterial({ color: 0xf1e7d0, roughness: 0.32, metalness: 0.0 }),
      black: new THREE.MeshStandardMaterial({ color: 0x2b2522, roughness: 0.28, metalness: 0.05 }),
    }

    this.buildBoard()
    this.buildOverlays()

    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2()
    this.downAt = null
    this.onPointerDown = (e) => {
      this.downAt = { x: e.clientX, y: e.clientY }
    }
    this.onPointerUp = (e) => {
      if (!this.downAt) return
      const moved = Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y)
      this.downAt = null
      if (moved < 6) this.handleClick(this.pick(e))
    }
    this.onPointerMove = (e) => {
      if (!this.interactive) {
        renderer.domElement.style.cursor = ''
        this.hover.visible = false
        return
      }
      const sq = this.pick(e)
      const clickable = sq && (this.targets.some((t) => t.to === sq) || this.handlers.getMoves?.(sq)?.length)
      renderer.domElement.style.cursor = clickable ? 'pointer' : ''
      if (clickable) {
        this.placeOverlay(this.hover, sq)
        this.hover.visible = true
      } else this.hover.visible = false
    }
    renderer.domElement.addEventListener('pointerdown', this.onPointerDown)
    renderer.domElement.addEventListener('pointerup', this.onPointerUp)
    renderer.domElement.addEventListener('pointermove', this.onPointerMove)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()

    this.setPosition(START_BOARD, { animate: false })
    this.setIdle(true)

    this.lastTime = performance.now()
    renderer.setAnimationLoop(() => this.frame())
  }

  buildBoard() {
    const board = new THREE.Group()
    const lightTex = woodTexture('#e6d2ad', '#a07a4c', 3)
    const darkTex = woodTexture('#8d5b3b', '#4a2a18', 7)
    const light = new THREE.MeshStandardMaterial({ map: lightTex, roughness: 0.55 })
    const dark = new THREE.MeshStandardMaterial({ map: darkTex, roughness: 0.5 })
    const sqGeo = new THREE.BoxGeometry(1, 0.2, 1)
    this.squareMeshes = []
    for (let f = 0; f < 8; f++) {
      for (let r = 0; r < 8; r++) {
        const sq = FILES[f] + (r + 1)
        const m = new THREE.Mesh(sqGeo, (f + r) % 2 === 0 ? dark : light)
        const [x, z] = squareToXZ(sq)
        m.position.set(x, -0.1, z)
        m.receiveShadow = true
        m.userData.square = sq
        board.add(m)
        this.squareMeshes.push(m)
      }
    }

    const frameTex = woodTexture('#4a2c1b', '#1e110a', 11)
    frameTex.wrapS = frameTex.wrapT = THREE.RepeatWrapping
    frameTex.repeat.set(3, 3)
    const frameMat = new THREE.MeshStandardMaterial({ map: frameTex, roughness: 0.45 })
    const frame = new THREE.Mesh(new THREE.BoxGeometry(9.3, 0.34, 9.3), frameMat)
    frame.position.y = -0.18
    frame.receiveShadow = true
    frame.castShadow = true
    board.add(frame)

    // Coordenadas en el marco
    const labelGeo = new THREE.PlaneGeometry(0.42, 0.42)
    for (let i = 0; i < 8; i++) {
      for (const side of [1, -1]) {
        const fileMat = new THREE.MeshBasicMaterial({ map: labelTexture(FILES[i], '#d9c29a'), transparent: true, depthWrite: false })
        const fl = new THREE.Mesh(labelGeo, fileMat)
        fl.rotation.x = -Math.PI / 2
        if (side === -1) fl.rotation.z = Math.PI
        fl.position.set(i - 3.5, 0.0, side * 4.32)
        board.add(fl)
        const rankMat = new THREE.MeshBasicMaterial({ map: labelTexture(String(i + 1), '#d9c29a'), transparent: true, depthWrite: false })
        const rl = new THREE.Mesh(labelGeo, rankMat)
        rl.rotation.x = -Math.PI / 2
        if (side === -1) rl.rotation.z = Math.PI
        rl.position.set(-side * 4.32, 0.0, 3.5 - i)
        board.add(rl)
      }
    }

    // Mesa
    const table = new THREE.Mesh(
      new THREE.CircleGeometry(30, 64),
      new THREE.MeshStandardMaterial({ color: 0x1d2027, roughness: 0.9 }),
    )
    table.rotation.x = -Math.PI / 2
    table.position.y = -0.36
    table.receiveShadow = true
    board.add(table)

    this.scene.add(board)
  }

  buildOverlays() {
    const plane = new THREE.PlaneGeometry(1, 1)
    const mk = (color, opacity) => {
      const m = new THREE.Mesh(
        plane,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
      )
      m.rotation.x = -Math.PI / 2
      m.visible = false
      m.renderOrder = 1
      this.scene.add(m)
      return m
    }
    this.lastFrom = mk(0xe0b84a, 0.32)
    this.lastTo = mk(0xe0b84a, 0.42)
    this.selectedOverlay = mk(0x58c79a, 0.5)
    this.hover = mk(0xffffff, 0.12)

    // Jaque: degradé radial rojo
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const ctx = c.getContext('2d')
    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64)
    grad.addColorStop(0, 'rgba(255,60,50,0.95)')
    grad.addColorStop(0.6, 'rgba(230,40,40,0.55)')
    grad.addColorStop(1, 'rgba(200,30,30,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 128, 128)
    this.checkOverlay = new THREE.Mesh(
      plane,
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
    )
    this.checkOverlay.rotation.x = -Math.PI / 2
    this.checkOverlay.visible = false
    this.checkOverlay.renderOrder = 2
    this.scene.add(this.checkOverlay)

    this.dotGeo = new THREE.CircleGeometry(0.15, 32)
    this.ringGeo = new THREE.RingGeometry(0.36, 0.47, 40)
    this.targetMat = new THREE.MeshBasicMaterial({ color: 0x1b3a2e, transparent: true, opacity: 0.45, depthWrite: false })
    this.captureMat = new THREE.MeshBasicMaterial({ color: 0xc8463c, transparent: true, opacity: 0.7, depthWrite: false })
    this.targetMeshes = []
  }

  placeOverlay(mesh, sq, y = 0.004) {
    const [x, z] = squareToXZ(sq)
    mesh.position.set(x, y, z)
  }

  resize() {
    const w = this.container.clientWidth || 1
    const h = this.container.clientHeight || 1
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    // En pantallas angostas alejar la cámara para que entre el tablero
    this.camera.fov = w / h < 0.8 ? 55 : 38
    this.camera.updateProjectionMatrix()
  }

  pick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const pieceMeshes = []
    for (const g of this.pieces.values()) pieceMeshes.push(g)
    const hitPiece = this.raycaster.intersectObjects(pieceMeshes, true)[0]
    if (hitPiece) {
      let o = hitPiece.object
      while (o && !o.userData.square) o = o.parent
      if (o) return o.userData.square
    }
    const hit = this.raycaster.intersectObjects(this.squareMeshes, false)[0]
    if (hit) return xzToSquare(hit.point.x, hit.point.z)
    return null
  }

  handleClick(sq) {
    if (!this.interactive || !sq) return
    if (this.selected) {
      const target = this.targets.find((t) => t.to === sq)
      if (target) {
        const from = this.selected
        this.clearSelection(false)
        this.handlers.onMove?.(from, sq)
        return
      }
      if (sq === this.selected) {
        this.clearSelection()
        return
      }
    }
    const moves = this.handlers.getMoves?.(sq) ?? []
    if (moves.length) this.select(sq, moves)
    else this.clearSelection()
  }

  select(sq, moves) {
    this.clearSelection()
    this.selected = sq
    this.placeOverlay(this.selectedOverlay, sq, 0.006)
    this.selectedOverlay.visible = true
    const seen = new Set()
    this.targets = moves.filter((m) => !seen.has(m.to) && seen.add(m.to))
    for (const t of this.targets) {
      const m = new THREE.Mesh(t.capture ? this.ringGeo : this.dotGeo, t.capture ? this.captureMat : this.targetMat)
      m.rotation.x = -Math.PI / 2
      m.renderOrder = 3
      this.placeOverlay(m, t.to, 0.012)
      this.scene.add(m)
      this.targetMeshes.push(m)
    }
    const piece = this.pieces.get(sq)
    if (piece) this.liftTo(piece, 0.18)
  }

  clearSelection(dropPiece = true) {
    if (this.selected && dropPiece) {
      const piece = this.pieces.get(this.selected)
      if (piece) this.liftTo(piece, 0)
    }
    this.selected = null
    this.targets = []
    this.selectedOverlay.visible = false
    for (const m of this.targetMeshes) this.scene.remove(m)
    this.targetMeshes = []
  }

  liftTo(piece, y) {
    const y0 = piece.position.y
    this.tween(0.15, (t) => {
      piece.position.y = y0 + (y - y0) * t
    })
  }

  tween(duration, update, done, delay = 0) {
    this.tweens.push({ t: -delay / duration, duration, update, done })
  }

  addPiece(code, sq) {
    const g = createPiece(code[1], code[0], this.materials)
    const [x, z] = squareToXZ(sq)
    g.position.set(x, 0, z)
    g.userData.square = sq
    g.userData.code = code
    this.scene.add(g)
    return g
  }

  removePiece(g, animate) {
    if (!animate) {
      this.scene.remove(g)
      return
    }
    g.userData.square = null
    this.tween(
      0.35,
      (t) => {
        const s = 1 - t * 0.9
        g.scale.setScalar(s)
        g.position.y = -0.4 * t
      },
      () => this.scene.remove(g),
      0.2,
    )
  }

  /** Lleva el tablero a la posición de la FEN, animando las diferencias. */
  setPosition(fen, { animate = true } = {}) {
    const next = parseBoard(fen)
    const prev = this.boardMap
    if (this.selected) this.clearSelection()

    if (!animate || prev.size === 0) {
      for (const g of this.pieces.values()) this.scene.remove(g)
      this.pieces.clear()
      for (const [sq, code] of next) this.pieces.set(sq, this.addPiece(code, sq))
      this.boardMap = next
      return
    }

    const sources = [] // casillas cuya pieza ya no está
    for (const [sq, code] of prev) if (next.get(sq) !== code) sources.push({ sq, code, used: false })
    const targets = []
    for (const [sq, code] of next) if (prev.get(sq) !== code) targets.push({ sq, code })

    const newPieces = new Map()
    for (const [sq, g] of this.pieces) if (prev.get(sq) === next.get(sq)) newPieces.set(sq, g)

    const dist = (a, b) => {
      const [ax, az] = squareToXZ(a)
      const [bx, bz] = squareToXZ(b)
      return Math.abs(ax - bx) + Math.abs(az - bz)
    }
    const nearest = (pred, to) => {
      let best = null
      for (const s of sources) {
        if (s.used || !pred(s)) continue
        if (!best || dist(s.sq, to) < dist(best.sq, to)) best = s
      }
      return best
    }

    for (const t of targets) {
      let src = nearest((s) => s.code === t.code, t.sq)
      let promote = false
      if (!src && t.code[1] !== 'p') {
        src = nearest((s) => s.code === t.code[0] + 'p', t.sq)
        promote = Boolean(src)
      }
      if (src) {
        src.used = true
        const g = this.pieces.get(src.sq)
        this.movePiece(g, src.sq, t.sq, promote ? t.code : null)
        newPieces.set(t.sq, g)
      } else {
        newPieces.set(t.sq, this.addPiece(t.code, t.sq))
      }
    }
    for (const s of sources) if (!s.used) this.removePiece(this.pieces.get(s.sq), true)

    // Las piezas promocionadas se reemplazan al terminar la animación
    this.pieces = newPieces
    this.boardMap = next
    for (const [sq, g] of newPieces) if (prev.get(sq) === next.get(sq) && g.position.y > 0.001) this.liftTo(g, 0)
  }

  movePiece(g, from, to, promoteTo) {
    const [x0, z0] = squareToXZ(from)
    const [x1, z1] = squareToXZ(to)
    const y0 = g.position.y
    const d = Math.hypot(x1 - x0, z1 - z0)
    const hop = g.userData.code[1] === 'n' ? 0.7 : 0.12 + d * 0.03
    g.userData.square = to
    this.tween(
      0.32 + d * 0.045,
      (t) => {
        const e = easeInOut(t)
        g.position.x = x0 + (x1 - x0) * e
        g.position.z = z0 + (z1 - z0) * e
        g.position.y = y0 * (1 - e) + Math.sin(Math.PI * e) * hop
      },
      () => {
        g.position.y = 0
        if (promoteTo && this.pieces.get(to) === g) {
          this.scene.remove(g)
          const ng = this.addPiece(promoteTo, to)
          ng.scale.setScalar(0.01)
          this.pieces.set(to, ng)
          this.tween(0.25, (t) => ng.scale.setScalar(0.01 + 0.99 * easeInOut(t)))
        }
      },
    )
  }

  /** Baja cualquier pieza que haya quedado levantada. */
  settle() {
    for (const g of this.pieces.values()) if (g.position.y > 0.001) this.liftTo(g, 0)
  }

  setLastMove(move) {
    if (move) {
      this.placeOverlay(this.lastFrom, move.from)
      this.placeOverlay(this.lastTo, move.to)
    }
    this.lastFrom.visible = this.lastTo.visible = Boolean(move)
  }

  setCheck(sq) {
    if (sq) this.placeOverlay(this.checkOverlay, sq, 0.008)
    this.checkOverlay.visible = Boolean(sq)
  }

  setInteractive(on) {
    this.interactive = on
    if (!on) {
      this.clearSelection()
      this.hover.visible = false
      this.renderer.domElement.style.cursor = ''
    }
  }

  setHandlers(handlers) {
    this.handlers = handlers
  }

  setIdle(idle) {
    this.idle = idle
    this.controls.autoRotate = idle
    if (idle) this.moveCamera(new THREE.Vector3(9, 8.5, 9))
  }

  setOrientation(color) {
    this.orientation = color
    const z = color === 'b' ? -10 : 10
    this.moveCamera(new THREE.Vector3(0, 10.5, z))
  }

  moveCamera(target) {
    const start = this.camera.position.clone()
    // Interpolar en coordenadas esféricas para girar alrededor del tablero
    const s0 = new THREE.Spherical().setFromVector3(start)
    const s1 = new THREE.Spherical().setFromVector3(target)
    let dTheta = s1.theta - s0.theta
    if (dTheta > Math.PI) dTheta -= Math.PI * 2
    if (dTheta < -Math.PI) dTheta += Math.PI * 2
    this.cameraTween = { t: 0, s0, s1, dTheta }
  }

  frame() {
    const now = performance.now()
    const dt = Math.min((now - this.lastTime) / 1000, 0.05)
    this.lastTime = now
    if (this.cameraTween) {
      const ct = this.cameraTween
      ct.t = Math.min(1, ct.t + dt / 1.1)
      const e = easeInOut(ct.t)
      const s = new THREE.Spherical(
        ct.s0.radius + (ct.s1.radius - ct.s0.radius) * e,
        ct.s0.phi + (ct.s1.phi - ct.s0.phi) * e,
        ct.s0.theta + ct.dTheta * e,
      )
      this.camera.position.setFromSpherical(s)
      if (ct.t >= 1) this.cameraTween = null
    }
    if (this.tweens.length) {
      const active = []
      for (const tw of this.tweens) {
        tw.t += dt / tw.duration
        if (tw.t < 0) {
          active.push(tw)
          continue
        }
        const t = Math.min(1, tw.t)
        tw.update(t)
        if (t >= 1) tw.done?.()
        else active.push(tw)
      }
      this.tweens = active
    }
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.renderer.setAnimationLoop(null)
    this.resizeObserver.disconnect()
    this.controls.dispose()
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown)
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp)
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove)
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        for (const m of mats) {
          m.map?.dispose()
          m.dispose()
        }
      }
    })
    this.envTexture.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
