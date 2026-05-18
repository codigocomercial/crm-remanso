/**
 * Mapeamento central de tabelas
 * Troque aqui para migrar o front-end do schema public para crm
 *
 * Leituras usam as views crm_* que apontam para crm.*
 * Escritas (insert/update/delete) apontam direto para crm.*
 * via API routes com service client
 */

// Tabelas de leitura (SELECT) — usam views do public que apontam para crm.*
export const T = {
  PRODUCTS:    'crm_products',    // view → crm.products
  COMPANIES:   'crm_companies',   // view → crm.companies
  SELLERS:     'crm_sellers',     // view → crm.sellers
  CONTACTS:    'contacts',        // ainda no public (migração fase 2)
  ORDERS:      'orders',          // ainda no public (migração após sync pedidos)
  ORDER_ITEMS: 'order_items',     // ainda no public
} as const

// Schema para escritas via service client (API routes)
export const SCHEMA = {
  PRODUCTS:  'crm',
  COMPANIES: 'crm',
  SELLERS:   'crm',
} as const
