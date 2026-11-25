import { useState } from 'react'
import { cleanName } from '../lib/player.js'
import { LEVEL_NAMES } from '../lib/chessUtils.js'

export function NameScreen({ initial, onSubmit }) {
  const [name, setName] = useState(initial)
  const clean = cleanName(name)
  return (
    <div className="screen">
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault()
          if (clean.length >= 2) onSubmit(clean)
        }}
      >
        <p className="eyebrow">Ajedrez 3D</p>
        <h1>¿Cómo te llamás?</h1>
        <p className="muted">Es el nombre que va a ver tu rival en las partidas online. No hace falta crear una cuenta.</p>
        <label className="field">
          <span>Nombre de usuario</span>
          <input
            autoFocus
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            placeholder="Por ejemplo: Tincho"
            autoComplete="nickname"
          />
        </label>
        {name && clean.length < 2 && <p className="hint">Tiene que tener al menos 2 letras.</p>}
        <button className="btn btn-primary" type="submit" disabled={clean.length < 2}>
          Entrar
        </button>
      </form>
    </div>
  )
}

function Segmented({ value, options, onChange, label }) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            className={value === v ? 'is-on' : ''}
            onClick={() => onChange(v)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

export function MainMenu({ name, onLocal, onOnline, onRename }) {
  const [color, setColor] = useState('w')
  const [level, setLevel] = useState(2)
  return (
    <div className="screen">
      <div className="card card-wide">
        <p className="eyebrow">Ajedrez 3D</p>
        <h1>Hola, {name}</h1>
        <div className="menu-grid">
          <section className="menu-block">
            <h2>Contra la computadora</h2>
            <Segmented
              label="Tu color"
              value={color}
              onChange={setColor}
              options={[
                ['w', 'Blancas'],
                ['b', 'Negras'],
                ['r', 'Al azar'],
              ]}
            />
            <Segmented
              label="Nivel"
              value={level}
              onChange={setLevel}
              options={Object.entries(LEVEL_NAMES).map(([k, v]) => [Number(k), v])}
            />
            <button
              className="btn btn-primary"
              onClick={() => onLocal({ color: color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : color, level })}
            >
              Jugar contra la computadora
            </button>
          </section>
          <section className="menu-block">
            <h2>Online</h2>
            <p className="muted">Creá una sala y pasale el código a alguien, o entrá a una sala que ya esté abierta.</p>
            <button className="btn btn-primary" onClick={onOnline}>
              Jugar online
            </button>
          </section>
        </div>
        <button className="btn btn-link" onClick={onRename}>
          Cambiar mi nombre
        </button>
      </div>
    </div>
  )
}
