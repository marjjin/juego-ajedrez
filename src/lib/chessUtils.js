import { Chess } from 'chess.js'

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/** Reconstruye la partida a partir de la lista de jugadas {from, to, promotion}. */
export function replay(moves) {
  const chess = new Chess()
  for (const m of moves) {
    try {
      chess.move({ from: m.from, to: m.to, promotion: m.promotion })
    } catch {
      break
    }
  }
  return chess
}

export function kingSquare(chess, color) {
  const board = chess.board()
  for (const row of board) {
    for (const p of row) {
      if (p && p.type === 'k' && p.color === color) return p.square
    }
  }
  return null
}

/** Estado derivado de la posición: turno, jaque, final de partida. */
export function gameInfo(chess) {
  const turn = chess.turn()
  const inCheck = chess.inCheck()
  const info = {
    turn,
    inCheck,
    checkSquare: inCheck ? kingSquare(chess, turn) : null,
    over: false,
    winner: null,
    reason: null,
  }
  if (chess.isCheckmate()) {
    Object.assign(info, { over: true, winner: turn === 'w' ? 'b' : 'w', reason: 'jaque mate' })
  } else if (chess.isStalemate()) {
    Object.assign(info, { over: true, winner: 'draw', reason: 'rey ahogado' })
  } else if (chess.isInsufficientMaterial()) {
    Object.assign(info, { over: true, winner: 'draw', reason: 'material insuficiente' })
  } else if (chess.isThreefoldRepetition()) {
    Object.assign(info, { over: true, winner: 'draw', reason: 'triple repetición' })
  } else if (chess.isDraw()) {
    Object.assign(info, { over: true, winner: 'draw', reason: 'regla de los 50 movimientos' })
  }
  return info
}

export function lastMoveOf(chess) {
  const h = chess.history({ verbose: true })
  const m = h[h.length - 1]
  return m ? { from: m.from, to: m.to } : null
}

export function needsPromotion(chess, from, to) {
  return chess.moves({ square: from, verbose: true }).some((m) => m.to === to && m.promotion)
}

export function targetsFor(chess, square) {
  return chess
    .moves({ square, verbose: true })
    .map((m) => ({ to: m.to, capture: Boolean(m.captured) }))
}

export const colorName = (c) => (c === 'w' ? 'blancas' : 'negras')

export const LEVEL_NAMES = { 1: 'Fácil', 2: 'Normal', 3: 'Difícil' }
