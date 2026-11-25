import { useEffect, useState } from 'react'
import { supabase, friendlyError, normalizeCode, randomCode } from '../lib/supabase.js'

const OPEN_WINDOW_MS = 60 * 60 * 1000

function timeAgo(iso) {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000)
  if (min < 1) return 'recién'
  if (min === 1) return 'hace 1 minuto'
  return `hace ${min} minutos`
}

export default function Lobby({ player, onEnter, onBack }) {
  const [color, setColor] = useState('w')
  const [code, setCode] = useState('')
  const [rooms, setRooms] = useState([])
  const [loadingRooms, setLoadingRooms] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let alive = true
    async function load() {
      const since = new Date(Date.now() - OPEN_WINDOW_MS).toISOString()
      const { data, error } = await supabase
        .from('chess_rooms')
        .select('id, code, white_id, white_name, black_id, black_name, updated_at')
        .eq('status', 'waiting')
        .gte('updated_at', since)
        .order('updated_at', { ascending: false })
        .limit(20)
      if (!alive) return
      setLoadingRooms(false)
      if (error) setError(friendlyError(error))
      else setRooms(data)
    }
    load()
    const channel = supabase
      .channel('chess-lobby')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chess_rooms' }, () => load())
      .subscribe()
    const timer = setInterval(load, 15000)
    return () => {
      alive = false
      clearInterval(timer)
      supabase.removeChannel(channel)
    }
  }, [])

  async function createRoom() {
    setCreating(true)
    setError('')
    const side = color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : color
    for (let attempt = 0; attempt < 5; attempt++) {
      const newCode = randomCode()
      const row = side === 'w' ? { white_id: player.id, white_name: player.name } : { black_id: player.id, black_name: player.name }
      const { error } = await supabase.from('chess_rooms').insert({ code: newCode, ...row })
      if (!error) {
        setCreating(false)
        onEnter(newCode)
        return
      }
      if (error.code !== '23505') {
        setError(friendlyError(error))
        break
      }
    }
    setCreating(false)
  }

  const cleanCode = normalizeCode(code)

  return (
    <div className="screen">
      <div className="card card-wide">
        <button className="btn btn-ghost btn-sm back" onClick={onBack}>
          ← Volver al menú
        </button>
        <h1>Jugar online</h1>
        {error && <p className="notice">{error}</p>}
        <div className="menu-grid">
          <section className="menu-block">
            <h2>Crear una sala</h2>
            <div className="field">
              <span>Querés jugar con</span>
              <div className="segmented" role="radiogroup" aria-label="Color">
                {[
                  ['w', 'Blancas'],
                  ['b', 'Negras'],
                  ['r', 'Al azar'],
                ].map(([v, t]) => (
                  <button key={v} type="button" role="radio" aria-checked={color === v} className={color === v ? 'is-on' : ''} onClick={() => setColor(v)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn btn-primary" onClick={createRoom} disabled={creating}>
              {creating ? 'Creando la sala…' : 'Crear sala'}
            </button>
          </section>

          <section className="menu-block">
            <h2>Entrar con un código</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (cleanCode.length >= 4) onEnter(cleanCode)
              }}
            >
              <label className="field">
                <span>Código de la sala</span>
                <input
                  className="code-input"
                  value={code}
                  onChange={(e) => setCode(normalizeCode(e.target.value))}
                  placeholder="ABCDE"
                  autoComplete="off"
                  spellCheck="false"
                />
              </label>
              <button className="btn btn-primary" type="submit" disabled={cleanCode.length < 4}>
                Entrar a la sala
              </button>
            </form>
          </section>
        </div>

        <section className="open-rooms">
          <h2>Salas abiertas</h2>
          {loadingRooms && <p className="muted">Buscando salas…</p>}
          {!loadingRooms && rooms.length === 0 && !error && (
            <p className="muted">No hay salas esperando rival. Creá una y pasale el código a alguien.</p>
          )}
          <ul>
            {rooms.map((r) => {
              const mine = r.white_id === player.id || r.black_id === player.id
              const host = r.white_name ?? r.black_name
              const freeColor = r.white_id ? 'negras' : 'blancas'
              return (
                <li key={r.id} className="room-item">
                  <div>
                    <strong>{host}</strong>
                    <small>
                      Sala {r.code} · jugás con {freeColor} · {timeAgo(r.updated_at)}
                    </small>
                  </div>
                  <button className="btn btn-sm" onClick={() => onEnter(r.code)}>
                    {mine ? 'Volver a mi sala' : 'Entrar'}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}
