import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`, got = req.headers.get('authorization') ?? ''
  if (!process.env.CRON_SECRET || got.length !== expected.length || !timingSafeEqual(Buffer.from(got), Buffer.from(expected)))
    return new NextResponse('Unauthorized', { status: 401 })
  const { data, error } = await createAdminClient().rpc('lock_expired_nodes') // idempotent + SKIP LOCKED
  if (error) return NextResponse.json({ ok: false }, { status: 500 })
  return NextResponse.json({ ok: true, locked: data })
}
