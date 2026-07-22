const NON_REVENUE_STATUSES = new Set(['cancelado', 'perdido'])

/** Indica se o pedido deve compor faturamento, volume e margem. */
export function isRevenueOrderStatus(status: string | null | undefined): boolean {
  return !status || !NON_REVENUE_STATUSES.has(status)
}
