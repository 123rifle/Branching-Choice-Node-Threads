'use server'
import { guard, ok, fail, dbError, type Result } from '@/lib/action'
import { commentSchema, reportSchema, uuid } from '@/lib/validations'

/** Generic idempotent toggle for follows / likes / bookmarks. Rows are scoped to auth.uid() by RLS. */
async function toggle(table: 'follows' | 'likes' | 'bookmarks', targetId: string, on: boolean): Promise<Result> {
  const g = await guard(`toggle:${table}`, 60, 60); if ('error' in g) return g.error
  if (!uuid.safeParse(targetId).success) return fail('Invalid input.')
  const { supabase, user } = g
  const col = table === 'follows' ? 'followee_id' : 'post_id', me = table === 'follows' ? 'follower_id' : 'user_id'
  if (table === 'follows' && targetId === user.id) return fail('You cannot follow yourself.')
  const q = on
    ? supabase.from(table).upsert({ [me]: user.id, [col]: targetId }, { onConflict: `${me},${col}`, ignoreDuplicates: true })
    : supabase.from(table).delete().eq(me, user.id).eq(col, targetId)
  const { error } = await q
  return error ? dbError(error) : ok()
}
export const setFollow = (userId: string, on: boolean) => toggle('follows', userId, on)
export const setLike = (postId: string, on: boolean) => toggle('likes', postId, on)
export const setBookmark = (postId: string, on: boolean) => toggle('bookmarks', postId, on)

export async function addComment(input: unknown): Promise<Result> {
  const g = await guard('comment', 10, 60); if ('error' in g) return g.error
  const p = commentSchema.safeParse(input); if (!p.success) return fail(p.error.issues[0].message)
  const { error } = await g.supabase.from('comments').insert({ post_id: p.data.postId, author_id: g.user.id, body: p.data.body, parent_id: p.data.parentId })
  return error ? dbError(error) : ok()
}
export async function deleteComment(id: string): Promise<Result> {
  const g = await guard('comment:del'); if ('error' in g) return g.error
  const { error } = await g.supabase.from('comments').delete().eq('id', id)
  return error ? dbError(error) : ok()
}
export async function reportContent(input: unknown): Promise<Result> {
  const g = await guard('report', 10, 3600); if ('error' in g) return g.error
  const p = reportSchema.safeParse(input); if (!p.success) return fail('Invalid report.')
  const { error } = await g.supabase.from('reports').insert({ reporter_id: g.user.id, target_type: p.data.targetType, target_id: p.data.targetId, reason: p.data.reason, details: p.data.details })
  return error?.code === '23505' ? ok() : error ? dbError(error) : ok() // duplicate report = already reported
}
export async function markNotificationsRead(ids?: string[]): Promise<Result> {
  const g = await guard('notif:read'); if ('error' in g) return g.error
  let q = g.supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', g.user.id).is('read_at', null)
  if (ids?.length) q = q.in('id', ids)
  const { error } = await q
  return error ? dbError(error) : ok()
}
