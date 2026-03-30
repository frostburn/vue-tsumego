import { ref } from 'vue'

export function useAbortableRequest() {
  const error = ref<Error | null>(null)
  let controller: AbortController | null = null

  function getRequestInit(): RequestInit | undefined {
    if (!controller) {
      return undefined
    }
    return { signal: controller.signal }
  }

  function resetController() {
    if (controller) {
      controller.abort()
    }
    controller = new AbortController()
    return { signal: controller.signal }
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
    getRequestInit,
    resetController,
    handleError,
  }
}
