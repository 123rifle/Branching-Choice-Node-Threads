import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const configured = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN
const cache = new Map<string, Ratelimit>()

/** Sliding-window limit keyed by user id. Fails closed in production if Upstash isn't configured. */
export async function limit(bucket: string, userId: string, max = 20, windowSec = 60) {
  if (!configured) return process.env.NODE_ENV !== 'production'
  const key = `${bucket}:${max}:${windowSec}`
  if (!cache.has(key)) cache.set(key, new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(max, `${windowSec} s`), prefix: `rl:${bucket}` }))
  return (await cache.get(key)!.limit(userId)).success
}
