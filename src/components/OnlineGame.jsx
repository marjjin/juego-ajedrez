import { useCallback, useEffect, useMemo, useState } from 'react'
import { useBoard } from './scene.js'
import { GamePanel, PlayerCard, PromotionPicker } from './GameHud.jsx'
import { supabase, friendlyError } from '../lib/supabase.js'
import { START_FEN, gameInfo, lastMoveOf, needsPromotion, replay, targetsFor } from '../lib/chessUtils.js'

const newer = (a, b) => Date.parse(a.updated_at) >= Date.parse(b.updated_at)

function reasonText(room) {
  if (room.reason === 'abandono') {
    const loser = room.winner === 'w' ? room.black_name : room.white_name
    return `abandono de ${loser}`
  }
  if (room.reason === 'acuerdo') return 'acuerdo entre los jugadores'
  return room.reason ?? ''
}

export default function OnlineGame({ player, code, onExit }) {
  const [room, setRoom] = useState(null)
  const [fatal, setFatal] = useState('')
  const [notice, setNotice] = useState('')
  const [onlineIds, setOnlineIds] = useState([])
  const [promo, setPromo] = useState(null)
  const [copied, setCopied] = useState(false)

  const applyRoom = useCallback((r) => {
    setRoom((cur) => (!cur || cur.id !== r.id || newer(r, cur) ? r : cur))
  }, [])

  const refetch = useCallback(
    async (id) => {
      const { data } = await supabase.from('chess_rooms').select('*').eq('id', id).maybeSingle()
      if (data) applyRoom(data)
    },
    [applyRoom],
  )

  // Cargar la sala, ocupar el lugar libre y suscribirse a los cambios
  useEffect(() => {
    let cancelled = false
    let channel = null

    async function start() {
      let { data, error } = await supabase.from('chess_rooms').select('*').eq('code', code).maybeSingle()
      if (cancelled) return
      if (error) return setFatal(friendlyError(error))
      if (!data) return setFatal(`No hay ninguna sala con el código ${code}. Revisá el código o creá una sala nueva.`)

      const isPlayer = data.white_id === player.id || data.black_id === player.id
      if (!isPlayer && data.status === 'waiting') {
        const slot = data.white_id ? 'black' : 'white'
        const res = await supabase
          .from('chess_rooms')
          .update({ [`${slot}_id`]: player.id, [`${slot}_name`]: player.name, status: 'playing' })
          .eq('id', data.id)
          .is(`${slot}_id`, null)
          .select()
          .maybeSingle()
        if (cancelled) return
        if (res.data) data = res.data
        else {
          const again = await supabase.from('chess_rooms').select('*').eq('id', data.id).maybeSingle()
          if (again.data) data = again.data
        }
      }
      setRoom(data)

      const id = data.id
      channel = supabase
        .channel(`chess-room:${id}`, { config: { presence: { key: player.id } } })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chess_rooms', filter: `id=eq.${id}` }, (p) =>
          applyRoom(p.new),
        )
        .on('presence', { event: 'sync' }, () => setOnlineIds(Object.keys(channel.presenceState())))
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({ name: player.name })
            refetch(id)
          }
        })
    }

    start()
    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [code, player.id, player.name, applyRoom, refetch])

  const roomMoves = room?.moves
  const chess = useMemo(() => replay(roomMoves ?? []), [roomMoves])
  const info = useMemo(() => gameInfo(chess), [chess])
  const history = useMemo(() => chess.history(), [chess])

  const myColor = room ? (room.white_id === player.id ? 'w' : room.black_id === player.id ? 'b' : null) : null
  const opponentId = myColor === 'w' ? room?.black_id : myColor === 'b' ? room?.white_id : null
  const playing = room?.status === 'playing'
  const myTurn = playing && myColor === info.turn

  async function update(patch, guard = {}) {
    const prev = room
    setRoom({ ...room, ...patch })
    let q = supabase.from('chess_rooms').update(patch).eq('id', room.id)
    for (const [k, v] of Object.entries(guard)) q = q.eq(k, v)
    const { data, error } = await q.select().maybeSingle()
    if (error) {
      setNotice(friendlyError(error))
      setRoom(prev)
      refetch(room.id)
    } else if (!data) {
      setNotice('La sala cambió mientras jugabas. Se actualizó con el último estado.')
      refetch(room.id)
    } else {
      setNotice('')
      applyRoom(data)
    }
  }

  function play(from, to, promotion) {
    const c = replay(room.moves)
    let m
    try {
      m = c.move({ from, to, promotion })
    } catch {
      return
    }
    const i = gameInfo(c)
    const patch = {
      moves: [...room.moves, { from: m.from, to: m.to, promotion: m.promotion }],
      fen: c.fen(),
      draw_offer_by: null,
      ...(i.over ? { status: 'finished', winner: i.winner, reason: i.reason } : {}),
    }
    update(patch, { fen: room.fen })
  }

  const scene = useBoard({
    fen: room?.fen ?? START_FEN,
    lastMove: lastMoveOf(chess),
    checkSquare: info.checkSquare,
    orientation: myColor ?? 'w',
    interactive: Boolean(myTurn) && !promo,
    getMoves: (sq) => {
      const p = chess.get(sq)
      return p && p.color === myColor ? targetsFor(chess, sq) : []
    },
    onMove: (from, to) => {
      if (needsPromotion(chess, from, to)) setPromo({ from, to })
      else play(from, to)
    },
  })

  const shareUrl = `${location.origin}${location.pathname}#sala=${code}`
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setNotice(`No se pudo copiar. Pasale este enlace a tu rival: ${shareUrl}`)
    }
  }

  const closeRoom = async () => {
    await supabase.from('chess_rooms').delete().eq('id', room.id).eq('status', 'waiting')
    onExit()
  }

  if (fatal) {
    return (
      <div className="screen">
        <div className="card">
          <h2>No se pudo abrir la sala</h2>
          <p>{fatal}</p>
          <button className="btn" onClick={onExit}>
            Volver a las salas
          </button>
        </div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="screen">
        <div className="card">
          <p>Conectando con la sala {code}…</p>
        </div>
      </div>
    )
  }

  const opponentOnline = opponentId ? onlineIds.includes(opponentId) : false
  const whiteCard = (
    <PlayerCard
      name={room.white_name}
      color="w"
      active={playing && info.turn === 'w'}
      note={myColor === 'w' ? 'vos' : null}
      online={room.white_id ? onlineIds.includes(room.white_id) : undefined}
    />
  )
  const blackCard = (
    <PlayerCard
      name={room.black_name}
      color="b"
      active={playing && info.turn === 'b'}
      note={myColor === 'b' ? 'vos' : null}
      online={room.black_id ? onlineIds.includes(room.black_id) : undefined}
    />
  )
  const [top, bottom] = myColor === 'b' ? [whiteCard, blackCard] : [blackCard, whiteCard]

  let status
  let tone = 'normal'
  if (room.status === 'waiting') {
    status = 'Esperando que se sume tu rival.'
  } else if (room.status === 'finished') {
    tone = 'result'
    const why = reasonText(room)
    if (room.winner === 'draw') status = `Tablas por ${why}.`
    else if (room.winner === myColor) status = `Ganaste por ${why}.`
    else {
      const winnerName = room.winner === 'w' ? room.white_name : room.black_name
      status = `Ganó ${winnerName} por ${why}.`
    }
  } else if (!myColor) {
    status = `Estás mirando la partida. Juegan las ${info.turn === 'w' ? 'blancas' : 'negras'}.`
  } else if (myTurn) {
    status = info.inCheck ? 'Estás en jaque. Te toca mover.' : 'Te toca mover.'
    tone = info.inCheck ? 'alert' : 'turn'
  } else {
    status = opponentOnline ? 'Juega tu rival.' : 'Juega tu rival. Ahora mismo no está conectado.'
  }

  const drawOffered = room.draw_offer_by && playing
  const offeredByMe = room.draw_offer_by === player.id
  const rematchByMe = room.rematch_by === player.id
  const rematchByOther = room.rematch_by && !rematchByMe

  const rematch = () => {
    if (rematchByOther) {
      update(
        {
          white_id: room.black_id,
          white_name: room.black_name,
          black_id: room.white_id,
          black_name: room.white_name,
          moves: [],
          fen: START_FEN,
          status: 'playing',
          winner: null,
          reason: null,
          rematch_by: null,
          draw_offer_by: null,
        },
        { status: 'finished' },
      )
    } else update({ rematch_by: player.id }, { status: 'finished' })
  }

  return (
    <>
      <GamePanel
        title={`Sala ${room.code}`}
        top={top}
        bottom={bottom}
        status={status}
        statusTone={tone}
        history={history}
        onExit={onExit}
        exitLabel="Salir de la sala"
      >
        {room.status === 'waiting' && (
          <div className="invite">
            <p className="muted">Pasale el código a tu rival para que entre desde “Jugar online”.</p>
            <div className="code-big">{room.code}</div>
            <button className="btn" onClick={copyLink}>
              {copied ? 'Enlace copiado' : 'Copiar enlace de invitación'}
            </button>
            <button className="btn btn-ghost" onClick={closeRoom}>
              Cerrar la sala
            </button>
          </div>
        )}

        {playing && myColor && drawOffered && !offeredByMe && (
          <div className="offer">
            <p>Tu rival ofrece tablas.</p>
            <div className="row">
              <button
                className="btn"
                onClick={() =>
                  update(
                    { status: 'finished', winner: 'draw', reason: 'acuerdo', draw_offer_by: null },
                    { status: 'playing' },
                  )
                }
              >
                Aceptar tablas
              </button>
              <button className="btn btn-ghost" onClick={() => update({ draw_offer_by: null })}>
                Rechazar
              </button>
            </div>
          </div>
        )}

        {playing && myColor && (
          <div className="row">
            <button
              className="btn btn-ghost"
              disabled={Boolean(drawOffered)}
              onClick={() => update({ draw_offer_by: player.id }, { status: 'playing' })}
            >
              {offeredByMe ? 'Tablas ofrecidas' : 'Ofrecer tablas'}
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (confirm('¿Seguro que querés abandonar? La partida se da por perdida.')) {
                  update(
                    { status: 'finished', winner: myColor === 'w' ? 'b' : 'w', reason: 'abandono', draw_offer_by: null },
                    { status: 'playing' },
                  )
                }
              }}
            >
              Abandonar
            </button>
          </div>
        )}

        {room.status === 'finished' && myColor && (
          <>
            {rematchByOther && <p>Tu rival quiere la revancha. Se cambian los colores.</p>}
            <button className="btn" onClick={rematch} disabled={rematchByMe}>
              {rematchByOther ? 'Aceptar la revancha' : rematchByMe ? 'Revancha pedida, esperando respuesta' : 'Pedir revancha'}
            </button>
          </>
        )}

        {notice && <p className="notice">{notice}</p>}
      </GamePanel>
      {promo && (
        <PromotionPicker
          color={myColor}
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
