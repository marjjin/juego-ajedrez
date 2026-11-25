import { useEffect, useRef } from 'react'
import { ChessScene } from '../three/ChessScene.js'

/** Lienzo 3D; avisa la instancia de la escena por onReady. */
export default function Board3D({ onReady }) {
  const ref = useRef(null)
  useEffect(() => {
    const scene = new ChessScene(ref.current)
    onReady(scene)
    if (import.meta.env.DEV) window.__chessScene = scene
    return () => {
      onReady(null)
      scene.dispose()
    }
  }, [onReady])
  return <div className="board3d" ref={ref} />
}
