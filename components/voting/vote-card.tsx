'use client'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { castVote } from '@/app/actions/votes'

type Choice = { id: string; label: string; vote_count: number; position: number }
type Props = {
  nodeId: string; closesAt: string; status: 'open' | 'locked'; winningChoiceId: string | null
  result: 'winner' | 'tied' | 'no_votes' | null; choices: Choice[]; totalVotes: number
  myChoiceId: string | null; serverNow: string; canVote: boolean
}

function useCountdown(closesAt: string, serverNow: string) {
  const offset = useMemo(() => new Date(serverNow).getTime() - Date.now(), [serverNow]) // server-authoritative clock
  const [ms, setMs] = useState(() => new Date(closesAt).getTime() - new Date(serverNow).getTime())
  useEffect(() => {
    const t = setInterval(() => setMs(new Date(closesAt).getTime() - (Date.now() + offset)), 250)
    return () => clearInterval(t)
  }, [closesAt, offset])
  return ms
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h ? `${h}h ${m}m` : m ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`
}

export function VoteCard(p: Props) {
  const router = useRouter()
  const [choices, setChoices] = useState(p.choices)
  const [total, setTotal] = useState(p.totalVotes)
  const [mine, setMine] = useState(p.myChoiceId)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const ms = useCountdown(p.closesAt, p.serverNow)
  const locked = p.status === 'locked'
  const expired = !locked && ms <= 0

  // Realtime: rows carry ABSOLUTE counts, so replays/duplicates can never double-increment.
  useEffect(() => {
    const supabase = createClient()
    const sync = async () => {
      const [{ data: cs }, { data: n }] = await Promise.all([
        supabase.from('choices').select('id,label,vote_count,position').eq('node_id', p.nodeId).order('position'),
        supabase.from('nodes').select('total_votes').eq('id', p.nodeId).single(),
      ])
      if (cs) setChoices(cs); if (n) setTotal(n.total_votes)
    }
    const ch = supabase.channel(`node:${p.nodeId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'choices', filter: `node_id=eq.${p.nodeId}` },
        (e) => setChoices((prev) => prev.map((c) => (c.id === e.new.id ? { ...c, vote_count: e.new.vote_count } : c))))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'nodes', filter: `id=eq.${p.nodeId}` },
        (e) => { setTotal(e.new.total_votes); if (e.new.status === 'locked') router.refresh() })
      .subscribe((s) => { if (s === 'SUBSCRIBED') sync() }) // authoritative refetch on connect/reconnect
    return () => { supabase.removeChannel(ch) }
  }, [p.nodeId, router])

  // When the timer hits zero, ask the server for the locked state (cron may lag up to a minute).
  useEffect(() => { if (expired) { const t = setInterval(() => router.refresh(), 5000); return () => clearInterval(t) } }, [expired, router])

  const showBars = locked || !!mine
  const sum = choices.reduce((a, c) => a + c.vote_count, 0)
  const tone = locked || expired ? 'text-zinc-500' : ms < 60_000 ? 'text-red-500 animate-pulse' : ms < 900_000 ? 'text-amber-400' : 'text-emerald-500'

  const vote = (id: string) => {
    if (!p.canVote || mine || locked || expired) return
    setError(null)
    start(async () => {
      const r = await castVote(p.nodeId, id)
      if (!r.ok) return setError(r.error)
      setMine(id); setTotal(r.data.total) // server-returned authoritative tally
      setChoices((prev) => prev.map((c) => ({ ...c, vote_count: r.data.choices.find((x) => x.id === c.id)?.count ?? c.vote_count })))
    })
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="text-zinc-400">{total} vote{total === 1 ? '' : 's'}</span>
        <span className={`font-mono ${tone}`}>{locked ? 'Closed' : expired ? 'Closing…' : fmt(ms)}</span>
      </div>
      <div className="space-y-2">
        {choices.map((c) => {
          const pct = sum ? Math.round((c.vote_count / sum) * 100) : 0
          const win = locked && c.id === p.winningChoiceId
          return (
            <button key={c.id} disabled={!p.canVote || !!mine || locked || expired || pending} onClick={() => vote(c.id)}
              className={`relative w-full overflow-hidden rounded-lg border px-4 py-3 text-left text-sm transition-colors
                ${mine === c.id ? 'border-indigo-500' : win ? 'border-emerald-500' : 'border-zinc-800 hover:border-zinc-600'} disabled:cursor-default`}>
              {showBars && <span className="absolute inset-y-0 left-0 bg-indigo-500/20 transition-all duration-500" style={{ width: `${pct}%` }} />}
              <span className="relative flex justify-between gap-3 text-zinc-50">
                <span>{c.label}{mine === c.id && ' ✓'}{win && ' 🏆'}</span>
                {showBars && <span className="text-zinc-400">{pct}%</span>}
              </span>
            </button>
          )
        })}
      </div>
      {locked && p.result !== 'winner' && <p className="mt-3 text-sm text-amber-400">{p.result === 'tied' ? 'Tied — waiting for the creator to decide.' : 'No votes were cast.'}</p>}
      {!p.canVote && !locked && <p className="mt-3 text-sm text-zinc-400">Sign in to vote.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}
    </div>
  )
}
