import { createClient } from '@/lib/supabase/server'
import { limit } from '@/lib/rate-limit'

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string }
export const ok = <T = undefined>(data?: T): Result<T> => ({ ok: true, data: data as T })
export const fail = (error: string): Result<never> => ({ ok: false, error })

const KNOWN: Record<string, string> = {
  auth_required: 'Please sign in.', voting_closed: 'Voting has closed for this chapter.',
  invalid_choice: 'That option does not belong to this chapter.', already_voted: 'You already voted on this chapter.',
  account_unavailable: 'Your account cannot perform this action.', not_allowed: 'You are not allowed to do that.',
}
/** Maps DB errors to safe messages; never leaks internals. */
export const dbError = (e: { message?: string } | null) =>
  fail(Object.entries(KNOWN).find(([k]) => e?.message?.includes(k))?.[1] ?? 'Something went wrong. Please try again.')

/** Verified user from the server session + rate limit. Client-supplied user ids are never used. */
export async function guard(bucket: string, max = 20, windowSec = 60) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: fail('Please sign in.') } as const
  if (!(await limit(bucket, user.id, max, windowSec))) return { error: fail('Too many requests. Slow down.') } as const
  return { supabase, user } as const
}
