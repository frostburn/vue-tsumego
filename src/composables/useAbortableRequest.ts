import { ref } from 'vue'

export function useAbortableRequest() {
  const error = ref<Error | null>(null)
  let initController: AbortController | null = null

  function getInitRequestInit(): RequestInit | undefined {
    if (!initController) {
      return undefined
    }
    return { signal: initController.signal }
  }

  function resetInitController() {
    if (initController) {
      initController.abort()
    }
    initController = new AbortController()
    return { signal: initController.signal }
  }

  function handleError(err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return
    }
    if (err instanceof Error) {
      error.value = err
      return
    }
    if (typeof err === 'string') {
      error.value = new Error(err)
      return
    }
    throw err
  }

  return {
    error,
    getInitRequestInit,
    resetInitController,
    handleError,
  }
}
