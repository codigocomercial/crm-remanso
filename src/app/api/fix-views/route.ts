import { NextResponse } from 'next/server'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const secret = process.env.SUPABASE_SECRET_KEY!

  const viewSQL = [
    `CREATE OR REPLACE VIEW public.crm_atendimentos AS
     SELECT a.*,
       c.full_name AS contact_name,
       COALESCE(co.fantasy_name, co.corporate_name) AS company_name
     FROM crm.atendimentos a
     LEFT JOIN crm.contacts c ON c.id = a.contact_id
     LEFT JOIN crm.companies co ON co.id = a.company_id`,
    `NOTIFY pgrst, 'reload schema'`,
  ]

  const erros: string[] = []

  for (const sql of viewSQL) {
    const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': secret,
        'Authorization': `Bearer ${secret}`,
      },
      body: JSON.stringify({ sql }),
    })
    if (!res.ok) erros.push(await res.text())
  }

  if (erros.length > 0) {
    return NextResponse.json({ ok: false, erros }, { status: 500 })
  }

  return NextResponse.json({ ok: true, message: 'View corrigida! Pode remover esta rota.' })
}
