import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!

// Coordenadas das cidades — fábrica em Vitória da Conquista
const FABRICA_LAT = -14.8619
const FABRICA_LNG = -40.8444

const COORDS: Record<string, [number, number]> = {
  'Salvador': [-12.9714, -38.5014],
  'Feira de Santana': [-12.2664, -38.9661],
  'Vitória da Conquista': [-14.8619, -40.8444],
  'VITORIA DA CONQUISTA': [-14.8619, -40.8444],
  'Ilhéus': [-14.7890, -39.0492],
  'Itabuna': [-14.7860, -39.2783],
  'Juazeiro': [-9.4219, -40.5031],
  'Barreiras': [-12.1522, -45.0006],
  'Guanambi': [-14.2228, -42.7814],
  'Jacobina': [-11.1822, -40.5158],
  'Seabra': [-12.4186, -41.7706],
  'Irecê': [-11.3039, -41.8558],
  'Poções': [-14.5219, -40.3664],
  'Caetité': [-14.0678, -42.4731],
  'Bom Jesus da Lapa': [-13.2553, -43.4189],
  'Luís Eduardo Magalhães': [-12.0964, -45.7961],
  'Alagoinhas': [-12.1364, -38.4197],
  'Itapetinga': [-15.2489, -40.2489],
  'Teixeira de Freitas': [-17.5350, -39.7414],
  'Eunápolis': [-16.3756, -39.5778],
  'Porto Seguro': [-16.4483, -39.0647],
  'Valença': [-13.3661, -39.0742],
  'Santo Antônio de Jesus': [-12.9706, -39.2617],
  'Cruz das Almas': [-12.6706, -39.1008],
  'Conceição do Coité': [-11.5603, -39.2839],
  'Ribeira do Pombal': [-10.8336, -38.5333],
  'Euclides da Cunha': [-10.5075, -39.0133],
  'Tucano': [-10.9678, -38.7881],
  'Cipó': [-11.0994, -38.5158],
  'Crisópolis': [-11.5128, -38.1497],
  'Sátiro Dias': [-11.5950, -38.5828],
  'Inhambupe': [-11.7822, -38.3553],
  'Esplanada': [-11.7939, -37.9458],
  'Cícero Dantas': [-10.5953, -38.3833],
  'Ribeirão do Largo': [-15.4531, -40.7336],
  'Tanque Novo': [-13.5478, -42.5139],
  'Macaúbas': [-13.0197, -42.6958],
  'Paramirim': [-13.4433, -42.2447],
  'Boquira': [-12.8664, -42.7297],
  'Caturama': [-13.3289, -42.3097],
  'Ibotirama': [-12.1800, -43.2194],
  'Ibicuí': [-14.8597, -39.9897],
  'Tanhaçu': [-14.0019, -41.2519],
  'Planalto': [-14.6550, -40.4717],
  'Cândido Sales': [-15.4958, -41.2289],
  'Barra do Choça': [-14.8633, -40.5756],
  'Tremedal': [-15.0747, -41.4508],
  'Anagé': [-14.6111, -41.1311],
  'Condeúba': [-14.9008, -41.8764],
  'Encruzilhada': [-15.5217, -40.9083],
  'Boa Nova': [-14.3608, -40.1978],
  'Cordeiros': [-15.0194, -41.9261],
  'Piripá': [-14.9497, -41.7397],
  'Dom Basílio': [-13.7586, -41.7706],
  'Livramento de Nossa Senhora': [-13.6525, -41.8433],
  'Iuiú': [-14.4133, -43.6411],
  'Palmas de Monte Alto': [-14.2650, -43.1619],
  'Ibiassucê': [-14.4800, -42.2664],
  'Rio do Pires': [-13.4331, -42.3078],
  'Botuporã': [-13.3178, -42.5078],
  'Ipupiara': [-11.8233, -42.6058],
  'Morpará': [-12.0839, -43.2897],
  'Malhada': [-14.3353, -43.7678],
  'Buritirama': [-10.7217, -43.6322],
  'Mansidão': [-10.7292, -44.0378],
  'Remanso': [-9.6253, -42.0778],
  'Pilão Arcado': [-10.0006, -41.9917],
  'Campo Alegre de Lourdes': [-9.5172, -43.0097],
  'Campo Formoso': [-10.5097, -40.3203],
  'Pindobaçu': [-10.7408, -40.3561],
  'Filadélfia': [-10.7453, -40.2939],
  'Caldeirão Grande': [-11.0114, -40.3028],
  'Serrolândia': [-11.4094, -40.2903],
  'Canarana': [-11.6783, -39.8175],
  'Lamarão': [-11.8203, -38.8814],
  'Cansanção': [-10.6650, -39.6639],
  'Santa Luzia': [-9.2317, -36.9197],
  'Valente': [-11.4036, -39.4664],
  'Pé de Serra': [-11.4997, -39.6131],
  'Capim Grosso': [-11.3819, -40.0136],
  'Andorinha': [-10.3700, -39.8408],
  'Itapicuru': [-11.3053, -38.2450],
  'Nova Soure': [-11.2339, -38.4828],
  'Cotegipe': [-12.0219, -44.2553],
  'Ibicoara': [-13.4008, -41.2889],
  'Mucugê': [-13.0006, -41.3689],
  'Serra Dourada': [-12.2800, -43.9678],
  'Baixa Grande': [-11.9589, -40.1664],
  'Ruy Barbosa': [-12.2844, -40.4942],
  'Mundo Novo': [-11.8597, -40.4708],
  'Itatim': [-12.7086, -39.6978],
  'Amargosa': [-13.0225, -39.6028],
  'Sapeaçu': [-12.7258, -39.1778],
  'Governador Mangabeira': [-12.6019, -39.0486],
  'Conceição do Almeida': [-12.7906, -39.2111],
  'São Gonçalo dos Campos': [-12.4358, -38.9678],
  'Cachoeira': [-12.6058, -38.9622],
  'Vera Cruz': [-12.9578, -38.6078],
  'Santo Amaro': [-12.5397, -38.7036],
  'Nazaré': [-13.0358, -39.0133],
  'Ituberá': [-13.7278, -39.1478],
  'Buerarema': [-14.9589, -39.3019],
  'Uruçuca': [-14.5939, -39.2939],
  'Itamaraju': [-17.0381, -39.5317],
  'Mascote': [-15.5617, -39.2983],
  'Jussari': [-15.1219, -39.4772],
  'Coaraci': [-14.6439, -39.5528],
  'Ibirataia': [-14.0272, -39.6494],
  'Ipiaú': [-14.1258, -39.7378],
  'Ubaitaba': [-14.1889, -39.3244],
  'Belmonte': [-15.8625, -38.8736],
  'Mucuri': [-18.0800, -39.5528],
  'Vereda': [-17.7517, -40.1789],
  'Itabela': [-16.6486, -39.5347],
  'Barra de São Francisco': [-18.7519, -40.8914],
  'Santa Maria de Jetibá': [-20.0297, -40.7464],
  'Itaguaçu': [-19.7983, -40.8581],
  'Água Doce do Norte': [-18.5469, -40.9878],
  'Mucurici': [-18.0983, -40.5606],
  'Conceição da Barra': [-18.5919, -39.7358],
  'Mantena': [-18.7803, -41.1278],
  'Governador Valadares': [-18.8511, -41.9494],
  'Teófilo Otoni': [-17.8578, -41.5053],
  'Almenara': [-16.1836, -40.6914],
  'Padre Paraíso': [-17.0697, -41.4733],
  'Novo Cruzeiro': [-17.4706, -41.8797],
  'Ponto dos Volantes': [-16.7014, -41.4981],
  'Itaipé': [-17.4219, -41.6736],
  'Galiléia': [-19.0097, -41.5383],
  'Conselheiro Pena': [-19.1769, -41.4694],
  'Nanuque': [-17.8394, -40.3539],
  'Janaúba': [-15.8011, -43.3078],
  'Monte Azul': [-15.1528, -42.8622],
  'Mirabela': [-16.2603, -44.1644],
  'Montalvânia': [-14.4353, -44.3667],
  'Jaíba': [-15.3478, -43.6703],
  'Itacarambi': [-14.8592, -44.0994],
  'Matias Cardoso': [-14.8553, -43.9139],
  'São Francisco': [-15.9497, -44.8619],
  'Lontra': [-15.9197, -44.3428],
  'Mamonas': [-15.0564, -42.7136],
  'Coração de Jesus': [-16.6878, -44.3619],
  'Espinosa': [-14.9286, -42.8125],
  'Mato Verde': [-15.3933, -42.8672],
  'Montes Claros': [-16.7353, -43.8619],
  'Rio Paranaíba': [-19.1903, -46.2458],
  'Águas Vermelhas': [-15.7478, -41.4592],
  'Rio do Prado': [-16.6169, -40.5725],
  'Taiobeiras': [-15.8094, -42.2297],
  'Chapada do Norte': [-17.6906, -42.5239],
  'Minas Novas': [-17.2194, -42.5597],
  'Malacacheta': [-17.8353, -42.0733],
  'Poço Verde': [-10.7253, -38.1833],
  'Simão Dias': [-10.7394, -37.8139],
  'Cristinápolis': [-11.4753, -37.7567],
  'Bom Jesus': [-9.0742, -44.3639],
  'Baixa Grande do Ribeiro': [-7.7319, -45.2317],
  'São João do Piauí': [-8.3578, -42.2494],
  'Fátima': [-10.7558, -38.2189],
  'São José do Jacuípe': [-11.4414, -39.8553],
  'Santa Bárbara': [-11.9611, -38.9700],
  'Macajuba': [-12.1494, -40.3628],
  'Itambé': [-15.2239, -40.6297],
  'Acajutiba': [-11.4617, -38.0214],
  'Boninal': [-12.7019, -41.8133],
  'Caculé': [-14.5019, -42.2211],
  'Presidente Jânio Quadros': [-14.6950, -41.6806],
  'Maetinga': [-14.6828, -41.4436],
  'Iguaí': [-14.7439, -40.0828],
  'Barra da Estiva': [-13.6258, -41.3333],
  'Candiba': [-14.3953, -42.8614],
  'Mortugaba': [-15.0175, -41.9822],
  'Cristópolis': [-12.2258, -45.4228],
  'Bonito': [-12.3089, -40.2853],
  'Tabocas do Brejo Velho': [-12.9197, -44.0008],
  'Ponto Novo': [-10.8619, -40.1317],
  'Várzea Nova': [-11.3678, -40.9239],
  'Itiúba': [-10.6925, -39.8497],
  'Serra Preta': [-12.1506, -39.3361],
  'Nova Redenção': [-12.8153, -40.7714],
  'São Domingos': [-11.7825, -39.9447],
  'Brejões': [-13.0567, -39.7969],
  'Itororó': [-15.1178, -40.0706],
  'Simões Filho': [-12.7881, -38.4033],
}

function calcularDistancia(city: string): number | null {
  const coords = COORDS[city]
  if (!coords) return null
  const [lat, lng] = coords
  const R = 6371
  const dLat = (lat - FABRICA_LAT) * Math.PI / 180
  const dLng = (lng - FABRICA_LNG) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(FABRICA_LAT * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return Math.round(R * c * 1.3) // fator 1.3 para distância rodoviária
}

async function getBlingToken() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('bling_tokens')
    .select('access_token')
    .single()
  return data?.access_token
}

async function blingFetch(path: string, token: string) {
  const res = await fetch(`https://www.bling.com.br/Api/v3${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`Bling API error ${res.status}: ${JSON.stringify(json)}`)
  return json
}

export async function POST() {
  try {
    const supabase = await createClient()
    const token = await getBlingToken()
    if (!token) return NextResponse.json({ error: 'Bling não conectado' }, { status: 401 })

    let totalVendedores = 0
    let totalEmpresas = 0
    let totalContatos = 0

    // 1. Sincronizar vendedores
    const vendedoresRes = await blingFetch('/vendedores?limite=100', token)
    for (const v of vendedoresRes?.data ?? []) {
      await supabase.from('sellers').upsert({
        org_id: ORG_ID,
        bling_id: v.id,
        name: v.nome,
        email: v.email ?? null,
        is_active: v.situacao === 'A',
        bling_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'bling_id' })
      totalVendedores++
    }

    // 2. Sincronizar empresas
    let page = 1
    while (true) {
      const data = await blingFetch(`/contatos?pagina=${page}&limite=100`, token)
      const contatos = data?.data ?? []
      if (contatos.length === 0) break

      for (const c of contatos) {
        let seller_id = null
        if (c.vendedor?.id) {
          const { data: seller } = await supabase
            .from('sellers').select('id').eq('bling_id', c.vendedor.id).single()
          seller_id = seller?.id ?? null
        }

        const city = c.endereco?.municipio ?? null
        const state = c.endereco?.uf ?? null
        const distance_km = city ? calcularDistancia(city) : null

        await supabase.from('companies').upsert({
          org_id: ORG_ID,
          bling_id: c.id,
          name: c.nome,
          cnpj: c.numeroDocumento ?? null,
          phone: c.telefone ?? null,
          whatsapp: c.celular ?? null,
          email: c.email ?? null,
          city,
          state,
          seller_id,
          distance_km,
          is_active: true,
          bling_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'bling_id' })

        totalEmpresas++

        // Contatos vinculados
        const { data: company } = await supabase
          .from('companies').select('id').eq('bling_id', c.id).single()

        for (const p of c.pessoasContato ?? []) {
          if (!p.nome) continue
          await supabase.from('contacts').upsert({
            org_id: ORG_ID,
            full_name: p.nome,
            phone: p.telefone ?? null,
            whatsapp: p.celular ?? null,
            email: p.email ?? null,
            company_id: company?.id ?? null,
            contact_role: p.cargo ?? null,
            receive_campaigns: false,
            source: 'bling',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'org_id,full_name,company_id' })
          totalContatos++
        }
      }

      if (contatos.length < 100) break
      page++
    }

    return NextResponse.json({ success: true, vendedores: totalVendedores, empresas: totalEmpresas, contatos: totalContatos })

  } catch (error: any) {
    console.error('[sync/empresas] erro:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
