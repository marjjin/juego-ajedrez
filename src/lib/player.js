const ID_KEY = 'ajedrez3d.playerId'
const NAME_KEY = 'ajedrez3d.playerName'

export function loadPlayer() {
  let id = localStorage.getItem(ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(ID_KEY, id)
  }
  return { id, name: localStorage.getItem(NAME_KEY) ?? '' }
}

export function saveName(name) {
  localStorage.setItem(NAME_KEY, name)
}

export function cleanName(text) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 20)
}
