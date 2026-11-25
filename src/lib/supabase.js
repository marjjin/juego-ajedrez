import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = url && key ? createClient(url, key) : null

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function randomCode(length = 5) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('')
}

export function normalizeCode(text) {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
}

/** Convierte un error de Supabase en un mensaje que se pueda mostrar. */
export function friendlyError(error) {
  if (!error) return ''
  const msg = `${error.code ?? ''} ${error.message ?? ''}`
  if (/42P01|PGRST205|Could not find the table|relation .* does not exist/i.test(msg)) {
    return 'Todavía no existe la tabla chess_rooms en Supabase. Ejecutá el archivo supabase/schema.sql en el SQL Editor del proyecto y volvé a intentar.'
  }
  if (/Failed to fetch|NetworkError|fetch failed/i.test(msg)) {
    return 'No hay conexión con el servidor. Revisá tu conexión a internet y probá de nuevo.'
  }
  return `El servidor respondió con un error: ${error.message ?? 'sin detalle'}.`
}
