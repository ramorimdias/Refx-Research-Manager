let currentActorName = ''

export function setCurrentActorName(name: string) {
  currentActorName = name.trim()
}

export function getCurrentActorName() {
  return currentActorName || undefined
}
