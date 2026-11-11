'use server'
import { guard, ok, fail, dbError, type Result } from '@/lib/action'
import { uuid } from '@/lib/validations'

export type Tally = { total: number; choices: { id: string; count: number }[] }

export async function castVote(nodeId: string, choiceId: string): Promise<Result<Tally>> {
  const g = await guard('vote', 30, 60); if ('error' in g) return g.error
  if (!uuid.safeParse(nodeId).success || !uuid.safeParse(choiceId).success) return fail('Invalid input.')
  const { data, error } = await g.supabase.rpc('cast_vote', { p_node_id: nodeId, p_choice_id: choiceId })
  return error ? dbError(error) : ok(data as Tally)
}
