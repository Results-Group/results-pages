import { describe, it, expect } from 'vitest'
import { ConflictLatch, chainSerialized, nextToken } from '@/lib/save-protocol'

describe('ConflictLatch', () => {
  it('latches on 409 and never unlatches', () => {
    const latch = new ConflictLatch()
    expect(latch.noteHttpStatus(200)).toBe(false)
    expect(latch.noteHttpStatus(409)).toBe(true)
    // A later success must NOT release it — only a reload does.
    expect(latch.noteHttpStatus(200)).toBe(true)
    expect(latch.latched).toBe(true)
  })

  it('other errors do not latch', () => {
    const latch = new ConflictLatch()
    latch.noteHttpStatus(500)
    latch.noteHttpStatus(403)
    expect(latch.latched).toBe(false)
  })
})

describe('chainSerialized', () => {
  it('runs saves strictly in order', async () => {
    const order: number[] = []
    let queue: Promise<unknown> = Promise.resolve()
    const slow = () => new Promise<void>(r => setTimeout(() => { order.push(1); r() }, 30))
    const fast = () => new Promise<void>(r => setTimeout(() => { order.push(2); r() }, 1))
    const q1 = chainSerialized(queue, slow); queue = q1
    const q2 = chainSerialized(queue, fast); queue = q2
    await queue
    // The slow request landed first even though the fast one finished sooner —
    // this is what stops a stale response resurrecting old content.
    expect(order).toEqual([1, 2])
  })

  it('a failed save does not wedge the queue', async () => {
    const order: string[] = []
    let queue: Promise<unknown> = Promise.resolve()
    queue = chainSerialized(queue, async () => { order.push('a'); throw new Error('network') })
    queue = chainSerialized(queue, async () => { order.push('b') })
    await queue
    expect(order).toEqual(['a', 'b'])
  })
})

describe('nextToken', () => {
  it('advances only from a response that carries updated_at', () => {
    expect(nextToken('t1', { updated_at: 't2' })).toBe('t2')
    expect(nextToken('t1', {})).toBe('t1')
    expect(nextToken('t1', null)).toBe('t1')
    expect(nextToken(null, { updated_at: 't2' })).toBe('t2')
    expect(nextToken(null, undefined)).toBeNull()
  })
})
