import { ref, reactive } from 'vue'
import { defineStore } from 'pinia'
import { API_URL, fetchJson } from '../util'

type Response = {
  collections: { slug: string; tsumegos: string[] }[]
}
type CollectionsRecord = Record<string, string[]>

export const useTsumegoStore = defineStore('tsumego', () => {
  const collections = ref<string[]>([])
  const tsumegosByCollection = reactive<CollectionsRecord>({})

  async function init() {
    if (!collections.value.length) {
      const json = await fetchJson<Response>(new URL('tsumego/?deep=1', API_URL))
      collections.value = json.collections.map((c) => c.slug)
      for (const c of json.collections) {
        tsumegosByCollection[c.slug] = c.tsumegos
      }
    }
  }

  async function next(collection: string, tsumego: string) {
    await init()

    if (!(collection in tsumegosByCollection)) {
      return null
    }
    const tsumegos = tsumegosByCollection[collection]!
    const idx = tsumegos.indexOf(tsumego)
    if (idx < 0) {
      return null
    }
    if (idx < tsumegos.length - 1) {
      return { collection, tsumego: tsumegos[idx + 1]! }
    }
    const cidx = collections.value.indexOf(collection)
    if (cidx < 0) {
      return null
    }
    if (cidx < collections.value.length - 1) {
      collection = collections.value[cidx + 1]!
      return {
        collection,
        tsumego: tsumegosByCollection[collection]![0]!,
      }
    }
    return null
  }

  async function previous(collection: string, tsumego: string) {
    await init()

    if (!(collection in tsumegosByCollection)) {
      return null
    }
    let tsumegos = tsumegosByCollection[collection]!
    const idx = tsumegos.indexOf(tsumego)
    if (idx < 0) {
      return null
    }
    if (idx > 0) {
      return { collection, tsumego: tsumegos[idx - 1]! }
    }
    const cidx = collections.value.indexOf(collection)
    if (cidx < 0) {
      return null
    }
    if (cidx > 0) {
      collection = collections.value[cidx - 1]!
      tsumegos = tsumegosByCollection[collection]!
      return {
        collection,
        tsumego: tsumegos[tsumegos.length - 1]!,
      }
    }
    return null
  }

  return { collections, tsumegosByCollection, previous, next }
})
