import { afterEach, describe, expect, it, vi } from 'vitest'
import { decode64, encode64, fetchJson } from '../util'

afterEach(() => {
  vi.restoreAllMocks()
})

// prettier-ignore
const ENCODED_100 = [
  '',   '1',  '2',  '3',  '4',  '5',  '6',  '7',  '8',  '9',  'a',
  'b',  'c',  'd',  'e',  'f',  'g',  'h',  'i',  'j',  'k',  'l',
  'm',  'n',  'o',  'p',  'q',  'r',  's',  't',  'u',  'v',  'w',
  'x',  'y',  'z',  'A',  'B',  'C',  'D',  'E',  'F',  'G',  'H',
  'I',  'J',  'K',  'L',  'M',  'N',  'O',  'P',  'Q',  'R',  'S',
  'T',  'U',  'V',  'W',  'X',  'Y',  'Z',  '-',  '_',  '01', '11',
  '21', '31', '41', '51', '61', '71', '81', '91', 'a1', 'b1', 'c1',
  'd1', 'e1', 'f1', 'g1', 'h1', 'i1', 'j1', 'k1', 'l1', 'm1', 'n1',
  'o1', 'p1', 'q1', 'r1', 's1', 't1', 'u1', 'v1', 'w1', 'x1', 'y1',
  'z1'
]

describe('URL-safe number encoder', () => {
  it('encodes small integers', () => {
    const strings = []
    for (let n = 0; n < 100; ++n) {
      strings.push(encode64(n))
    }
    expect(strings).toEqual(ENCODED_100)
  })

  it('encodes the largest supported integer', () => {
    expect(encode64(Number.MAX_SAFE_INTEGER)).toBe('________v')
  })
})

describe('URL-safe number decoder', () => {
  it('decodes small integers', () => {
    expect(ENCODED_100.map(decode64)).toEqual([...Array(100).keys()])
  })

  it('decodes the largest supported integer', () => {
    expect(decode64('________v')).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('agrees with the encoder in random cases', () => {
    for (let i = 0; i < 100; ++i) {
      const r = Math.floor(Math.random() * 2 ** 32)
      expect(decode64(encode64(r))).toBe(r)
    }
  })

  it('throws on invalid encoded characters', () => {
    expect(() => decode64('!')).toThrow('Invalid query encoding')
  })
})

describe('fetchJson', () => {
  it('returns parsed JSON for successful responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(fetchJson<{ ok: boolean }>('https://example.com')).resolves.toEqual({ ok: true })
  })

  it('throws a helpful error for failed responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('nope', {
        status: 503,
        statusText: 'Service Unavailable',
      }),
    )

    await expect(fetchJson('https://example.com')).rejects.toThrow(
      'Request failed: 503 Service Unavailable',
    )
  })
})
