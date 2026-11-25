import { createContext, useContext, useEffect } from 'react'
import { START_FEN } from '../lib/chessUtils.js'

export const SceneContext = createContext(null)

export function useScene() {
  return useContext(SceneContext)
}

/** Sincroniza el estado de una partida con la escena 3D. */
export function useBoard({ fen, lastMove, checkSquare, orientation, interactive, getMoves, onMove }) {
  const scene = useScene()

  useEffect(() => {
    if (!scene) return
    scene.setIdle(false)
    return () => {
      scene.setInteractive(false)
      scene.setHandlers({})
      scene.setLastMove(null)
      scene.setCheck(null)
      scene.setPosition(START_FEN)
      scene.setIdle(true)
    }
  }, [scene])

  useEffect(() => {
    scene?.setOrientation(orientation)
  }, [scene, orientation])

  useEffect(() => {
    scene?.setPosition(fen)
  }, [scene, fen])

  const lastFrom = lastMove?.from
  const lastTo = lastMove?.to
  useEffect(() => {
    scene?.setLastMove(lastFrom ? { from: lastFrom, to: lastTo } : null)
  }, [scene, lastFrom, lastTo])

  useEffect(() => {
    scene?.setCheck(checkSquare)
  }, [scene, checkSquare])

  useEffect(() => {
    scene?.setInteractive(interactive)
  }, [scene, interactive])

  useEffect(() => {
    scene?.setHandlers({ getMoves, onMove })
  })

  return scene
}
