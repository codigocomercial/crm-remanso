export type CrmOrderStatus = 'em_aberto' | 'em_andamento' | 'atendido' | 'cancelado'

interface BlingOrderSituation {
  id?: unknown
  valor?: unknown
}

const STATUS_BY_VALUE: Record<number, CrmOrderStatus> = {
  0: 'em_aberto',
  1: 'atendido',
  2: 'cancelado',
  3: 'em_andamento',
}

// Compatibilidade com respostas antigas que não traziam `situacao.valor`.
const LEGACY_STATUS_BY_ID: Record<number, CrmOrderStatus> = {
  6: 'em_aberto',
  9: 'em_aberto',
  11: 'em_aberto',
  12: 'atendido',
  13: 'cancelado',
  15: 'em_andamento',
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/**
 * Converte a situação do pedido do Bling para o status interno do CRM.
 * `valor` é o código padronizado; `id` identifica o cadastro e pode variar.
 */
export function mapBlingOrderStatus(
  situation: BlingOrderSituation | null | undefined,
): CrmOrderStatus {
  const value = toFiniteNumber(situation?.valor)
  if (value !== null) return STATUS_BY_VALUE[value] ?? 'em_aberto'

  const legacyId = toFiniteNumber(situation?.id)
  if (legacyId !== null) return LEGACY_STATUS_BY_ID[legacyId] ?? 'em_aberto'

  return 'em_aberto'
}
