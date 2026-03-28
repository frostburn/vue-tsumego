import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { State } from '../../core/state'

const routeMock: { query?: Record<string, unknown> } = { query: {} }

const previousMock = vi.fn().mockResolvedValue(null)
const nextMock = vi.fn().mockResolvedValue(null)

vi.mock('vue-router', () => ({
  useRoute: () => routeMock,
}))

vi.mock('../../stores/tsumego', () => ({
  useTsumegoStore: () => ({ previous: previousMock, next: nextMock }),
}))

vi.mock('../../util', async () => {
  const actual = await vi.importActual<typeof import('../../util')>('../../util')
  return {
    ...actual,
    fetchJson: vi.fn(),
    getSolutionInfo: vi.fn(),
  }
})

import TsumegoView from '../TsumegoView.vue'
import { fetchJson, getSolutionInfo } from '../../util'

const fetchJsonMock = vi.mocked(fetchJson)
const getSolutionInfoMock = vi.mocked(getSolutionInfo)

function mountView() {
  return shallowMount(TsumegoView, {
    props: {
      collection: 'cho-elementary',
    },
    global: {
      stubs: {
        RouterLink: true,
      },
    },
  })
}

describe('TsumegoView custom-study init', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const root = new State().toJSON()
    fetchJsonMock.mockResolvedValue({
      title: 'Elementary Collection',
      root,
      canStretch: false,
    })
    getSolutionInfoMock.mockResolvedValue({
      score: 0,
      scoreStdev: 0,
      scoreSq: 0,
      scoreSqStdev: 0,
      highScore: 0,
      highScoreStdev: 0,
      lowScore: 0,
      lowScoreStdev: 0,
      moves: [],
    })
  })

  it('falls back to root position subtitle when query s is missing', async () => {
    routeMock.query = {}

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('h1').text()).toContain('Elementary Collection: Custom Study (root position)')
    expect(wrapper.text()).not.toContain('No custom position found')
    expect(getSolutionInfoMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to root position subtitle when query s is empty', async () => {
    routeMock.query = { s: '' }

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('h1').text()).toContain('Elementary Collection: Custom Study (root position)')
    expect(wrapper.text()).not.toContain('Invalid query encoding')
    expect(getSolutionInfoMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to root position subtitle when query s is invalid', async () => {
    routeMock.query = { s: '!' }

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('h1').text()).toContain('Elementary Collection: Custom Study (root position)')
    expect(wrapper.text()).not.toContain('Invalid query encoding')
    expect(getSolutionInfoMock).toHaveBeenCalledTimes(1)
  })
})
