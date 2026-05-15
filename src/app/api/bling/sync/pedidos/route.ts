import { NextResponse } from 'next/server'
import { syncPedidos } from '@/lib/bling/sync-runner'

export async function POST() {
  try {
    const stats = await syncPedidos()
    return NextResponse.json({ success: true, ...stats })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
