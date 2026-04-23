import { logOperation } from '../utils/logger'

let activeMutation: Promise<unknown> | null = null
let activeMutationLabel: string | null = null

export function isDocumentMutationActive() {
  return activeMutation != null
}

export async function runExclusiveDocumentMutation<T>(
  label: string,
  action: () => Promise<T>,
): Promise<T> {
  if (activeMutation) {
    throw new Error(`Word is still finishing "${activeMutationLabel ?? 'another action'}". Please wait a moment and try again.`)
  }

  activeMutationLabel = label
  const mutation = (async () => {
    // Yield once so the lock is visible before the Office.js mutation body starts.
    await Promise.resolve()
    return logOperation(label, action)
  })()
  activeMutation = mutation

  try {
    return await mutation
  } finally {
    if (activeMutation === mutation) {
      activeMutation = null
      activeMutationLabel = null
    }
  }
}
