/**
 * Sequential API queue.
 *
 * All API calls are processed in order — each waits for the previous
 * to complete before starting. This prevents race conditions when
 * e.g. adding a person and then immediately editing them (the edit
 * must wait for the add to finish on the server).
 */

type QueueItem = {
  fn: () => Promise<void>
  onError?: () => void
}

let queue: QueueItem[] = []
let processing = false

async function processQueue() {
  if (processing) return
  processing = true

  while (queue.length > 0) {
    const item = queue.shift()!
    try {
      await item.fn()
    } catch {
      item.onError?.()
    }
  }

  processing = false
}

/**
 * Enqueue an async API call. It will run after all previously
 * enqueued calls have completed.
 */
export function enqueueApiCall(fn: () => Promise<void>, onError?: () => void) {
  queue.push({ fn, onError })
  processQueue()
}
