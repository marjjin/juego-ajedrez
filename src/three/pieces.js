import * as THREE from 'three'

const V = (x, y) => new THREE.Vector2(x, y)

function base(r) {
  return [V(0, 0), V(r, 0), V(r, 0.045), V(r - 0.025, 0.075), V(r - 0.01, 0.1), V(r - 0.06, 0.135), V(r - 0.1, 0.16)]
}

/** Puntos de un arco (para cabezas redondeadas), de abajo hacia arriba. */
function arc(cx, cy, r, from = -Math.PI / 2, to = Math.PI / 2, n = 10) {
  const pts = []
  for (let i = 0; i <= n; i++) {
    const a = from + ((to - from) * i) / n
    pts.push(V(Math.max(0, cx + Math.cos(a) * r), cy + Math.sin(a) * r))
  }
  return pts
}

const lathe = (points) => {
  const g = new THREE.LatheGeometry(points, 40)
  g.computeVertexNormals()
  return g
}

const PROFILES = {
  p: () => [
    ...base(0.3),
    V(0.13, 0.2), V(0.1, 0.36), V(0.16, 0.4), V(0.16, 0.43), V(0.09, 0.46),
    ...arc(0, 0.56, 0.12, -Math.PI / 2 + 0.6, Math.PI / 2),
  ],
  r: () => [
    ...base(0.34),
    V(0.23, 0.2), V(0.2, 0.52), V(0.27, 0.56), V(0.27, 0.74), V(0.2, 0.74), V(0.2, 0.68), V(0, 0.68),
  ],
  b: () => [
    ...base(0.32),
    V(0.13, 0.2), V(0.095, 0.56), V(0.17, 0.6), V(0.17, 0.63), V(0.1, 0.66),
    V(0.13, 0.7), V(0.155, 0.78), V(0.14, 0.86), V(0.1, 0.94), V(0.05, 0.99), V(0.03, 1.0),
    ...arc(0, 1.04, 0.045, -Math.PI / 2 + 0.5, Math.PI / 2, 8),
  ],
  q: () => [
    ...base(0.36),
    V(0.16, 0.22), V(0.11, 0.68), V(0.2, 0.73), V(0.2, 0.77), V(0.12, 0.8),
    V(0.15, 0.92), V(0.21, 1.02), V(0.18, 1.03), V(0.1, 1.05),
    ...arc(0, 1.1, 0.06, -Math.PI / 2 + 0.6, Math.PI / 2, 8),
  ],
  k: () => [
    ...base(0.37),
    V(0.17, 0.22), V(0.12, 0.72), V(0.21, 0.77), V(0.21, 0.81), V(0.13, 0.84),
    V(0.16, 0.96), V(0.2, 1.04), V(0.12, 1.08), V(0, 1.08),
  ],
  n: () => [...base(0.34), V(0.2, 0.2), V(0.19, 0.28), V(0, 0.28)],
}

let cache = null

function buildGeometries() {
  const g = {}
  for (const type of Object.keys(PROFILES)) g[type] = lathe(PROFILES[type]())

  // Almenas de la torre
  g.merlon = new THREE.BoxGeometry(0.12, 0.1, 0.1)

  // Corona de la dama
  g.crownBall = new THREE.SphereGeometry(0.03, 12, 8)

  // Cruz del rey
  g.crossV = new THREE.BoxGeometry(0.06, 0.22, 0.06)
  g.crossH = new THREE.BoxGeometry(0.17, 0.06, 0.06)

  // Cabeza del caballo: perfil lateral extruido
  const s = new THREE.Shape()
  s.moveTo(-0.2, 0.0)
  s.lineTo(0.18, 0.0)
  s.quadraticCurveTo(0.2, 0.18, 0.06, 0.3)
  s.quadraticCurveTo(0.2, 0.36, 0.31, 0.42)
  s.quadraticCurveTo(0.36, 0.5, 0.3, 0.56)
  s.quadraticCurveTo(0.18, 0.62, 0.08, 0.68)
  s.lineTo(0.05, 0.8)
  s.lineTo(-0.02, 0.7)
  s.quadraticCurveTo(-0.2, 0.66, -0.25, 0.42)
  s.quadraticCurveTo(-0.27, 0.2, -0.2, 0.0)
  const head = new THREE.ExtrudeGeometry(s, {
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.03,
    bevelSegments: 3,
    curveSegments: 16,
  })
  head.translate(0, 0, -0.08)
  head.computeVertexNormals()
  g.knightHead = head
  g.knightEye = new THREE.SphereGeometry(0.022, 8, 6)
  return g
}

function geometries() {
  if (!cache) cache = buildGeometries()
  return cache
}

function makeMesh(geometry, material) {
  const m = new THREE.Mesh(geometry, material)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

/**
 * Crea una pieza como THREE.Group con el origen en la base.
 * type: p n b r q k; color: w b
 */
export function createPiece(type, color, materials) {
  const g = geometries()
  const mat = color === 'w' ? materials.white : materials.black
  const group = new THREE.Group()
  group.add(makeMesh(g[type], mat))

  if (type === 'r') {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4
      const m = makeMesh(g.merlon, mat)
      m.position.set(Math.cos(a) * 0.21, 0.79, Math.sin(a) * 0.21)
      m.rotation.y = -a
      group.add(m)
    }
  }

  if (type === 'q') {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2
      const m = makeMesh(g.crownBall, mat)
      m.position.set(Math.cos(a) * 0.19, 1.04, Math.sin(a) * 0.19)
      group.add(m)
    }
  }

  if (type === 'k') {
    const v = makeMesh(g.crossV, mat)
    v.position.y = 1.18
    const h = makeMesh(g.crossH, mat)
    h.position.y = 1.2
    group.add(v, h)
  }

  if (type === 'n') {
    const head = new THREE.Group()
    head.add(makeMesh(g.knightHead, mat))
    const eyeMat = color === 'w' ? materials.black : materials.white
    for (const z of [-0.105, 0.105]) {
      const eye = new THREE.Mesh(g.knightEye, eyeMat)
      eye.position.set(0.17, 0.52, z)
      head.add(eye)
    }
    head.position.y = 0.26
    // Mirar hacia el rival: las blancas hacia -z, las negras hacia +z
    head.rotation.y = color === 'w' ? Math.PI / 2 : -Math.PI / 2
    group.add(head)
  }

  group.userData.type = type
  group.userData.color = color
  return group
}
