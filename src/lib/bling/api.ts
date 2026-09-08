/**
 * Endpoints do Bling API v3
 *
 * O host www.bling.com.br foi bloqueado para requisições de API — responde 403
 * FORBIDDEN ("A URL 'www.bling.com.br' está bloqueada para requisições de API").
 * Todas as chamadas de dados devem usar api.bling.com.br.
 */
export const BLING_API_URL = 'https://api.bling.com.br/Api/v3'

/** Tela de login/consentimento — é página web, não requisição de API. */
export const BLING_AUTHORIZE_URL = 'https://www.bling.com.br/Api/v3/oauth/authorize'

export const BLING_TOKEN_URL = `${BLING_API_URL}/oauth/token`

/** Host antigo — usado só como fallback na troca de tokens. */
export const BLING_TOKEN_URL_LEGACY = 'https://www.bling.com.br/Api/v3/oauth/token'

/**
 * Extrai a mensagem de erro do corpo devolvido pelo Bling.
 * Sem isso, uma mudança de contrato aparece só como "Bling 403: /pedidos/vendas".
 */
export async function blingErrorMessage(res: Response, path: string) {
  let detail = ''
  try {
    const body = await res.clone().json()
    const err = body?.error
    detail = [err?.message, err?.description].filter(Boolean).join(' — ')
  } catch {
    detail = (await res.clone().text().catch(() => '')).slice(0, 200)
  }
  return `Bling ${res.status}: ${path}${detail ? ` — ${detail}` : ''}`
}

/**
 * POST no /oauth/token. Tenta o host oficial e cai no antigo se ele recusar,
 * para a renovação de token não depender de qual host o Bling ainda aceita.
 */
export async function blingTokenRequest(credentials: string, body: URLSearchParams) {
  const init: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  }

  const res = await fetch(BLING_TOKEN_URL, init)
  if (res.ok || res.status === 400 || res.status === 401) return res

  const fallback = await fetch(BLING_TOKEN_URL_LEGACY, { ...init, body: body.toString() })
  return fallback.ok ? fallback : res
}
