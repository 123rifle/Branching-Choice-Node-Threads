'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fail, type Result } from '@/lib/action'
import { signupSchema, loginSchema } from '@/lib/validations'

export async function signUp(input: unknown): Promise<Result> {
  const p = signupSchema.safeParse(input); if (!p.success) return fail(p.error.issues[0].message)
  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: p.data.email, password: p.data.password,
    options: { data: { username: p.data.username }, emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
  })
  if (error) return fail(/username|profiles/i.test(error.message) ? 'That username is taken or invalid.' : 'Could not sign up.')
  return { ok: true, data: undefined } // email verification required before first login
}

export async function logIn(input: unknown): Promise<Result> {
  const p = loginSchema.safeParse(input); if (!p.success) return fail('Invalid credentials.')
  const { error } = await (await createClient()).auth.signInWithPassword(p.data)
  if (error) return fail('Invalid credentials or unverified email.')
  redirect('/nexus')
}
export async function logOut() { await (await createClient()).auth.signOut(); redirect('/') }

export async function requestReset(email: string): Promise<Result> {
  await (await createClient()).auth.resetPasswordForEmail(email, { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/settings` })
  return { ok: true, data: undefined } // same response whether or not the email exists
}
