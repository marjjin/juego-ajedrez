import { useEffect, useRef } from 'react'

const GLYPHS = {
  w: { q: '♕', r: '♖', b: '♗', n: '♘' },
  b: { q: '♛', r: '♜', b: '♝', n: '♞' },
}
const PROMO_NAMES = { q: 'Dama', r: 'Torre', b: 'Alfil', n: 'Caballo' }

export function PlayerCard({ name, color, active, note, online }) {
  return (
    <div className={`player-card ${active ? 'is-active' : ''}`}>
      <span className={`swatch swatch-${color}`} aria-hidden="true" />
      <div className="player-text">
        <strong>{name || 'Esperando rival'}</strong>
        <small>
          {color === 'w' ? 'Blancas' : 'Negras'}
          {note ? ` · ${note}` : ''}
        </small>
      </div>
      {online !== undefined && (
        <span className={`dot ${online ? 'dot-on' : 'dot-off'}`} title={online ? 'Conectado' : 'Sin conexión'} />
      )}
    </div>
  )
}

export function MoveList({ history }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [history.length])
  const rows = []
  for (let i = 0; i < history.length; i += 2) rows.push([history[i], history[i + 1]])
  return (
    <div className="move-list" ref={ref}>
      {rows.length === 0 && <p className="muted">Todavía no hay jugadas.</p>}
      {rows.map(([w, b], i) => (
        <div className="move-row" key={i}>
          <span className="move-num">{i + 1}.</span>
          <span>{w}</span>
          <span>{b ?? ''}</span>
        </div>
      ))}
    </div>
  )
}

export function PromotionPicker({ color, onPick, onCancel }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Elegí la pieza para coronar">
        <h3>Coronación</h3>
        <p className="muted">Elegí en qué pieza se convierte el peón.</p>
        <div className="promo-grid">
          {['q', 'r', 'b', 'n'].map((p) => (
            <button key={p} className="promo-btn" onClick={() => onPick(p)}>
              <span className="glyph">{GLYPHS[color][p]}</span>
              {PROMO_NAMES[p]}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

/** Panel lateral con jugadores, estado, jugadas y acciones. */
export function GamePanel({ title, top, bottom, status, statusTone, history, children, onExit, exitLabel = 'Salir al menú' }) {
  return (
    <>
      <header className="topbar">
        <button className="btn btn-ghost btn-sm" onClick={onExit}>
          ← {exitLabel}
        </button>
        <span className="topbar-title">{title}</span>
      </header>
      <aside className="game-panel">
        {top}
        <div className={`status status-${statusTone ?? 'normal'}`}>{status}</div>
        <MoveList history={history} />
        {bottom}
        <div className="panel-actions">{children}</div>
      </aside>
    </>
  )
}
