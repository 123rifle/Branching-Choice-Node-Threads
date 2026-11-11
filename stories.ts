'use server'
import { revalidatePath } from 'next/cache'
import { guard, ok, fail, dbError, type Result } from '@/lib/action'
import { storySchema, chapterSchema, uuid } from '@/lib/validations'

type Chapter = ReturnType<typeof chapterSchema.parse>

async function insertChoices(supabase: any, nodeId: string, choices: Chapter['choices']) {
  return supabase.from('choices').insert(choices.map((c, i) => ({ node_id: nodeId, position: i + 1, label: c.label, next_prompt: c.nextPrompt ?? null })))
}

export async function createStory(input: unknown): Promise<Result<{ postId: string }>> {
  const g = await guard('story:create', 10, 3600); if ('error' in g) return g.error
  const p = storySchema.safeParse(input); if (!p.success) return fail(p.error.issues[0].message)
  const { supabase, user } = g, d = p.data

  const { data: post, error: e1 } = await supabase.from('posts')
    .insert({ creator_id: user.id, title: d.title, description: d.description, cover_url: d.coverUrl, topic: d.topic, continuation: d.continuation })
    .select('id').single()
  if (e1 || !post) return dbError(e1)

  const { data: node, error: e2 } = await supabase.from('nodes')
    .insert({ post_id: post.id, chapter_number: 1, prompt: d.prompt, media_url: d.mediaUrl, duration_seconds: d.duration })
    .select('id').single()
  const e3 = node ? (await insertChoices(supabase, node.id, d.choices)).error : e2
  if (e3 || !node) { await supabase.from('posts').delete().eq('id', post.id); return dbError(e3) } // cascade cleanup

  if (d.publish) {
    const { error } = await supabase.rpc('publish_node', { p_node_id: node.id })
    if (error) return dbError(error)
  }
  revalidatePath('/nexus'); revalidatePath('/studio')
  return ok({ postId: post.id })
}

/** Next chapter. via_choice_id is derived from the server-stored winner, never from the client. */
export async function createNextChapter(postId: string, parentNodeId: string, input: unknown): Promise<Result<{ nodeId: string }>> {
  const g = await guard('story:chapter', 30, 3600); if ('error' in g) return g.error
  const p = chapterSchema.safeParse(input); if (!p.success || !uuid.safeParse(postId).success || !uuid.safeParse(parentNodeId).success) return fail('Invalid input.')
  const { supabase } = g
  const { data: parent } = await supabase.from('nodes').select('chapter_number, status, winning_choice_id, is_final, post_id').eq('id', parentNodeId).single()
  if (!parent || parent.post_id !== postId || parent.status !== 'locked' || !parent.winning_choice_id || parent.is_final)
    return fail('The previous round must be closed with a winning choice (resolve ties first).')

  const { data: node, error } = await supabase.from('nodes').insert({
    post_id: postId, parent_node_id: parentNodeId, via_choice_id: parent.winning_choice_id,
    chapter_number: parent.chapter_number + 1, prompt: p.data.prompt, media_url: p.data.mediaUrl, duration_seconds: p.data.duration,
  }).select('id').single()
  if (error || !node) return dbError(error) // RLS enforces ownership; unique(post_id, chapter_number) blocks duplicates
  const { error: ce } = await insertChoices(supabase, node.id, p.data.choices)
  if (ce) { await supabase.from('nodes').delete().eq('id', node.id); return dbError(ce) }
  if (p.data.publish) { const { error: pe } = await supabase.rpc('publish_node', { p_node_id: node.id }); if (pe) return dbError(pe) }
  revalidatePath(`/stories/${postId}`)
  return ok({ nodeId: node.id })
}

export async function publishNode(nodeId: string): Promise<Result> {
  const g = await guard('story:publish', 30, 3600); if ('error' in g) return g.error
  if (!uuid.safeParse(nodeId).success) return fail('Invalid input.')
  const { error } = await g.supabase.rpc('publish_node', { p_node_id: nodeId })
  return error ? dbError(error) : ok()
}
export async function resolveNode(nodeId: string, choiceId: string): Promise<Result> {
  const g = await guard('story:resolve'); if ('error' in g) return g.error
  const { error } = await g.supabase.rpc('resolve_node', { p_node_id: nodeId, p_choice_id: choiceId })
  return error ? dbError(error) : ok()
}
export async function endStory(nodeId: string): Promise<Result> {
  const g = await guard('story:end'); if ('error' in g) return g.error
  const { error } = await g.supabase.rpc('end_story', { p_node_id: nodeId })
  return error ? dbError(error) : ok()
}
export async function archiveStory(postId: string): Promise<Result> {
  const g = await guard('story:archive'); if ('error' in g) return g.error
  const { error } = await g.supabase.rpc('set_post_status', { p_post_id: postId, p_status: 'archived' })
  return error ? dbError(error) : ok()
}
export async function deleteStory(postId: string): Promise<Result> {
  const g = await guard('story:delete', 10, 3600); if ('error' in g) return g.error
  const { count } = await g.supabase.from('nodes').select('id', { count: 'exact', head: true }).eq('post_id', postId).neq('status', 'draft')
  if (count) return fail('Published stories can be archived, not deleted.') // protects voting history
  const { error } = await g.supabase.from('posts').delete().eq('id', postId)
  return error ? dbError(error) : ok()
}
