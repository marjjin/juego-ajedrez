import { useCallback, useEffect, useState } from 'react'
import Board3D from './components/Board3D.jsx'
import { SceneContext } from './components/scene.js'
import { MainMenu, NameScreen } from './components/Menus.jsx'
import Lobby from './components/Lobby.jsx'
import LocalGame from './components/LocalGame.jsx'
import OnlineGame from './components/OnlineGame.jsx'
import { loadPlayer, saveName } from './lib/player.js'
import { normalizeCode, supabase } from './lib/supabase.js'

function codeFromHash() {
  const m = location.hash.match(/sala=([A-Za-z0-9]+)/)
  return m ? normalizeCode(m[1]) : null
}

function setHash(code) {
  const url = code ? `#sala=${code}` : location.pathname + location.search
  history.replaceState(null, '', url)
}

export default function App() {
  const [player, setPlayer] = useState(loadPlayer)
  const [view, setView] = useState(() => {
    const code = codeFromHash()
    if (!player.name) return { name: 'name', pendingCode: code }
    return code ? { name: 'online', code } : { name: 'menu' }
  })
  const [scene, setScene] = useState(null)
  const onReady = useCallback((s) => setScene(s), [])

  useEffect(() => {
    setHash(view.name === 'online' ? view.code : null)
  }, [view])

  const goMenu = () => setView({ name: 'menu' })
  const needsSupabase = !supabase && (view.name === 'online' || view.name === 'lobby')

  let content
  if (view.name === 'name') {
    content = (
      <NameScreen
        initial={player.name}
        onSubmit={(name) => {
          saveName(name)
          setPlayer((p) => ({ ...p, name }))
          setView(view.pendingCode ? { name: 'online', code: view.pendingCode } : { name: 'menu' })
        }}
      />
    )
  } else if (needsSupabase) {
    content = (
      <div className="screen">
        <div className="card">
          <h2>Falta configurar Supabase</h2>
          <p>
            Para jugar online hace falta el archivo <code>.env</code> con <code>VITE_SUPABASE_URL</code> y{' '}
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>. Agregalo y reiniciá el servidor.
          </p>
          <button className="btn" onClick={goMenu}>
            Volver al menú
          </button>
        </div>
      </div>
    )
  } else if (view.name === 'menu') {
    content = (
      <MainMenu
        name={player.name}
        onLocal={(opts) => setView({ name: 'local', ...opts, key: Date.now() })}
        onOnline={() => setView({ name: 'lobby' })}
        onRename={() => setView({ name: 'name' })}
      />
    )
  } else if (view.name === 'lobby') {
    content = <Lobby player={player} onBack={goMenu} onEnter={(code) => setView({ name: 'online', code })} />
  } else if (view.name === 'local') {
    content = <LocalGame key={view.key} player={player} color={view.color} level={view.level} onExit={goMenu} />
  } else if (view.name === 'online') {
    content = <OnlineGame key={view.code} player={player} code={view.code} onExit={() => setView({ name: 'lobby' })} />
  }

  const inGame = view.name === 'local' || (view.name === 'online' && !needsSupabase)
  return (
    <SceneContext.Provider value={scene}>
      <div className={`app ${inGame ? 'mode-game' : 'mode-menu'}`}>
        <Board3D onReady={onReady} />
        <div className={`ui ${inGame ? 'ui-game' : 'ui-menu'}`}>{content}</div>
      </div>
    </SceneContext.Provider>
  )
}
