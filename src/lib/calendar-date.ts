export interface CalendarDateParts {
  year: number
  month: number
  day: number
}

/**
 * Extrai a data de calendário do prefixo ISO sem convertê-la para o fuso local.
 * Datas de pedidos do Bling representam um dia comercial, não um instante.
 */
export function getCalendarDateParts(value: string | null | undefined): CalendarDateParts | null {
  if (!value) return null

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const normalized = new Date(Date.UTC(year, month - 1, day))

  if (
    normalized.getUTCFullYear() !== year ||
    normalized.getUTCMonth() + 1 !== month ||
    normalized.getUTCDate() !== day
  ) {
    return null
  }

  return { year, month, day }
}

export function formatCalendarDate(value: string | null | undefined): string {
  const parts = getCalendarDateParts(value)
  if (!parts) return '—'

  return `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}/${parts.year}`
}

export function startOfCalendarMonthUtc(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toISOString()
}

export function startOfNextCalendarMonthUtc(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 1)).toISOString()
}

export function startOfCalendarDayUtc(value: string): string | null {
  const parts = getCalendarDateParts(value)
  if (!parts) return null
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).toISOString()
}

export function startOfNextCalendarDayUtc(value: string): string | null {
  const parts = getCalendarDateParts(value)
  if (!parts) return null
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1)).toISOString()
}
