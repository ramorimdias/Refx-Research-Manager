'use client'

type QueueEntry<T> = {
  key: string
  factory: () => Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
  signal?: AbortSignal
}

const queue: QueueEntry<unknown>[] = []
const inFlight = new Map<string, Promise<unknown>>()

let drainScheduled = false
let lastStartedAt = 0

function createAbortError() {
  return new DOMException('Aborted', 'AbortError')
}

function scheduleDrain() {
  if (drainScheduled) return
  drainScheduled = true

  const now = Date.now()
  const delay = Math.max(0, 1000 - (now - lastStartedAt))

  window.setTimeout(() => {
    drainScheduled = false
    void drainQueue()
  }, delay)
}

async function drainQueue() {
  if (queue.length === 0) return

  const entry = queue.shift()
  if (!entry) return

  if (entry.signal?.aborted) {
    entry.reject(createAbortError())
    if (queue.length > 0) scheduleDrain()
    return
  }

  lastStartedAt = Date.now()

  const promise = entry.factory()
  inFlight.set(entry.key, promise)

  try {
    const result = await promise
    entry.resolve(result)
  } catch (error) {
    entry.reject(error)
  } finally {
    inFlight.delete(entry.key)
    if (queue.length > 0) scheduleDrain()
  }
}

export async function enqueue<T>(
  key: string,
  factory: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) {
    throw createAbortError()
  }

  const existing = inFlight.get(key)
  if (existing) {
    return existing as Promise<T>
  }

  return new Promise<T>((resolve, reject) => {
    const entry: QueueEntry<T> = {
      key,
      factory,
      resolve,
      reject,
      signal,
    }

    const onAbort = () => {
      const index = queue.indexOf(entry as QueueEntry<unknown>)
      if (index >= 0) {
        queue.splice(index, 1)
      }
      reject(createAbortError())
    }

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true })
      const wrappedResolve = resolve
      const wrappedReject = reject
      entry.resolve = (value) => {
        signal.removeEventListener('abort', onAbort)
        wrappedResolve(value)
      }
      entry.reject = (reason) => {
        signal.removeEventListener('abort', onAbort)
        wrappedReject(reason)
      }
    }

    queue.push(entry as QueueEntry<unknown>)
    scheduleDrain()
  })
}
