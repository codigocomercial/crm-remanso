import { NextResponse } from 'next/server'
import { syncPedidos } from '@/lib/bling/sync-runner'
import { createServiceClient, ORG_ID } from '@/lib/supabase/service'

export async function POST() {
  try {
    // Verificar token antes de disparar
    const supabase = createServiceClient()
    const { data: token } = await supabase
      .from('bling_tokens')
      .select('access_token')
      .eq('org_id', ORG_ID)
      .single()

    if (!token?.access_token) {
      return NextResponse.json({ error: 'Bling não conectado' }, { status: 401 })
    }

    // Disparar em background — pedidos podem demorar 20-30 min
    syncPedidos().then(stats => {
      console.log('[sync/pedidos] concluído:', stats)
    }).catch(err => {
      console.error('[sync/pedidos] erro:', err.message)
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Sincronização iniciada — os pedidos aparecem em alguns minutos' 
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
