import { useEffect, useMemo, useRef, useState } from 'react'
import { useBoard } from './scene.js'
import { GamePanel, PlayerCard, PromotionPicker } from './GameHud.jsx'
import { LEVEL_NAMES, gameInfo, lastMoveOf, needsPromotion, replay, targetsFor } from '../lib/chessUtils.js'

const MIN_THINK_MS = 450

export default function LocalGame({ player, color, level, onExit }) {
  const [moves, setMoves] = useState([])
  const [promo, setPromo] = useState(null)
  const chess = useMemo(() => replay(moves), [moves])
  const info = useMemo(() => gameInfo(chess), [chess])
  const history = useMemo(() => chess.history(), [chess])
  const aiColor = color === 'w' ? 'b' : 'w'
  const aiThinking = !info.over && info.turn === aiColor
  const myTurn = !info.over && info.turn === color

  // Motor en un Web Worker para no trabar la animación
  const workerRef = useRef(null)
  const pliesRef = useRef(0)
  useEffect(() => {
    const worker = new Worker(new URL('../lib/ai.worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      const { id, move, startedAt } = e.data
      if (!move || id !== pliesRef.current) return
      const wait = Math.max(0, MIN_THINK_MS - (performance.now() - startedAt))
      setTimeout(() => {
        if (id !== pliesRef.current) return
        setMoves((m) => (m.length === id ? [...m, move] : m))
      }, wait)
    }
    workerRef.current = worker
    return () => worker.terminate()
  }, [])

  useEffect(() => {
    pliesRef.current = moves.length
  }, [moves])

  const fen = chess.fen()
  useEffect(() => {
    if (!aiThinking || !workerRef.current) return
    workerRef.current.postMessage({ id: moves.length, fen, level, startedAt: performance.now() })
  }, [aiThinking, fen, level, moves.length])

  const play = (from, to, promotion) => {
    setMoves((m) => [...m, { from, to, promotion }])
  }

  const scene = useBoard({
    fen,
    lastMove: lastMoveOf(chess),
    checkSquare: info.checkSquare,
    orientation: color,
    interactive: myTurn && !promo,
    getMoves: (sq) => {
      const p = chess.get(sq)
      return p && p.color === color ? targetsFor(chess, sq) : []
    },
    onMove: (from, to) => {
      if (needsPromotion(chess, from, to)) setPromo({ from, to })
      else play(from, to)
    },
  })

  const canUndo = !aiThinking && moves.length >= (info.over && info.turn !== color ? 1 : 2)
  const undo = () => {
    setMoves((m) => {
      const back = info.over && info.turn !== color ? 1 : 2
      return m.slice(0, Math.max(0, m.length - back))
    })
  }

  let status
  let tone = 'normal'
  if (info.over) {
    tone = 'result'
    if (info.winner === 'draw') status = `Tablas por ${info.reason}.`
    else if (info.winner === color) status = `Ganaste por ${info.reason}.`
    else status = `Ganó la computadora por ${info.reason}.`
  } else if (aiThinking) {
    status = 'La computadora está pensando…'
  } else {
    status = info.inCheck ? 'Estás en jaque. Te toca mover.' : 'Te toca mover.'
    tone = info.inCheck ? 'alert' : 'turn'
  }

  const me = <PlayerCard name={player.name} color={color} active={info.turn === color && !info.over} note="vos" />
  const cpu = (
    <PlayerCard name="Computadora" color={aiColor} active={info.turn === aiColor && !info.over} note={LEVEL_NAMES[level]} />
  )

  return (
    <>
      <GamePanel
        title={`Contra la computadora · ${LEVEL_NAMES[level]}`}
        top={cpu}
        bottom={me}
        status={status}
        statusTone={tone}
        history={history}
        onExit={onExit}
      >
        <button className="btn btn-ghost" onClick={undo} disabled={!canUndo}>
          Deshacer jugada
        </button>
        <button className="btn" onClick={() => setMoves([])}>
          Empezar de nuevo
        </button>
      </GamePanel>
      {promo && (
        <PromotionPicker
          color={color}
          onPick={(p) => {
            play(promo.from, promo.to, p)
            setPromo(null)
          }}
          onCancel={() => {
            setPromo(null)
            scene?.settle()
          }}
        />
      )}
    </>
  )
}
