// Motor simple: negamax con poda alfa-beta, profundización iterativa y quiescencia.
// Usa la generación interna de jugadas de chess.js (tablero 0x88) por velocidad.
import { Chess } from 'chess.js'

const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }

// Tablas de posición desde el punto de vista de las blancas; índice 0 = a8, 63 = h1.
const PST = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20,
  ],
  // Rey en el final: centralizarse
  kEnd: [
    -50, -40, -30, -20, -20, -30, -40, -50,
    -30, -20, -10, 0, 0, -10, -20, -30,
    -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -30, 0, 0, 0, 0, -30, -30,
    -50, -30, -30, -30, -30, -30, -30, -50,
  ],
}

const MATE = 100000
const LEVELS = {
  1: { depth: 1, time: 400, noise: 120 },
  2: { depth: 3, time: 1500, noise: 20 },
  3: { depth: 5, time: 3500, noise: 0 },
}

class Timeout extends Error {}

function evaluateWhite(board) {
  let score = 0
  let heavy = 0
  for (let i = 0; i < 128; i++) {
    if (i & 0x88) { i += 7; continue }
    const p = board[i]
    if (p && p.type !== 'k' && p.type !== 'p') heavy += VALUE[p.type]
  }
  const endgame = heavy <= 1600
  for (let i = 0; i < 128; i++) {
    if (i & 0x88) { i += 7; continue }
    const p = board[i]
    if (!p) continue
    const row = i >> 4
    const file = i & 7
    const idx = p.color === 'w' ? row * 8 + file : (7 - row) * 8 + file
    const table = p.type === 'k' && endgame ? PST.kEnd : PST[p.type]
    const v = VALUE[p.type] + table[idx]
    score += p.color === 'w' ? v : -v
  }
  return score
}

function moveScore(m) {
  let s = 0
  if (m.captured) s += 10 * VALUE[m.captured] - VALUE[m.piece] + 1000
  if (m.promotion) s += VALUE[m.promotion] + 900
  return s
}

function ordered(moves, first) {
  const scored = moves.map((m) => ({ m, s: moveScore(m) }))
  if (first) {
    for (const x of scored) {
      if (x.m.from === first.from && x.m.to === first.to && x.m.promotion === first.promotion) x.s = 1e9
    }
  }
  scored.sort((a, b) => b.s - a.s)
  return scored.map((x) => x.m)
}

function createSearch(chess, deadline) {
  let nodes = 0
  const checkTime = () => {
    if ((++nodes & 1023) === 0 && performance.now() > deadline) throw new Timeout()
  }
  const sideEval = () => {
    const e = evaluateWhite(chess._board)
    return chess._turn === 'w' ? e : -e
  }

  function quiesce(alpha, beta, qd) {
    checkTime()
    const stand = sideEval()
    if (stand >= beta) return beta
    if (stand > alpha) alpha = stand
    if (qd >= 6) return alpha
    const caps = ordered(chess._moves({ legal: true }).filter((m) => m.captured || m.promotion))
    for (const m of caps) {
      chess._makeMove(m)
      const score = -quiesce(-beta, -alpha, qd + 1)
      chess._undoMove()
      if (score >= beta) return beta
      if (score > alpha) alpha = score
    }
    return alpha
  }

  function negamax(depth, alpha, beta, ply) {
    checkTime()
    const moves = chess._moves({ legal: true })
    if (moves.length === 0) {
      return chess._isKingAttacked(chess._turn) ? -MATE + ply : 0
    }
    if (chess._halfMoves >= 100) return 0
    if (depth <= 0) return quiesce(alpha, beta, 0)
    for (const m of ordered(moves)) {
      chess._makeMove(m)
      const score = -negamax(depth - 1, -beta, -alpha, ply + 1)
      chess._undoMove()
      if (score >= beta) return beta
      if (score > alpha) alpha = score
    }
    return alpha
  }

  return { negamax }
}

const SQ = (i) => 'abcdefgh'[i & 7] + (8 - (i >> 4))

function chooseMove(fen, levelId) {
  const level = LEVELS[levelId] ?? LEVELS[2]
  const chess = new Chess(fen)
  const deadline = performance.now() + level.time
  const { negamax } = createSearch(chess, deadline)
  const rootMoves = chess._moves({ legal: true })
  if (rootMoves.length === 0) return null

  let best = rootMoves[0]
  for (let depth = 1; depth <= level.depth; depth++) {
    try {
      let alpha = -Infinity
      let bestScore = -Infinity
      let depthBest = null
      for (const m of ordered(rootMoves, best)) {
        chess._makeMove(m)
        // Con ruido, cada jugada necesita su valor exacto (ventana completa);
        // si no, la poda devuelve cotas y el ruido las vuelve engañosas.
        const raw = -negamax(depth - 1, -Infinity, level.noise ? Infinity : -alpha, 1)
        chess._undoMove()
        const score = level.noise && Math.abs(raw) < MATE - 100 ? raw + (Math.random() - 0.5) * level.noise : raw
        if (raw > alpha) alpha = raw
        if (score > bestScore) {
          bestScore = score
          depthBest = m
        }
      }
      if (depthBest) best = depthBest
      if (alpha > MATE - 100) break
    } catch (e) {
      if (e instanceof Timeout) {
        // deshacer lo que haya quedado aplicado
        chess.load(fen)
        break
      }
      throw e
    }
  }
  return { from: SQ(best.from), to: SQ(best.to), promotion: best.promotion }
}

self.onmessage = (e) => {
  const { fen, level } = e.data
  try {
    self.postMessage({ ...e.data, move: chooseMove(fen, level) })
  } catch (err) {
    // Si algo falla con los internos, jugar cualquier jugada legal
    const chess = new Chess(fen)
    const moves = chess.moves({ verbose: true })
    const m = moves[Math.floor(Math.random() * moves.length)]
    self.postMessage({ ...e.data, move: m ? { from: m.from, to: m.to, promotion: m.promotion } : null, error: String(err) })
  }
}
