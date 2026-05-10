// ── Permissões por role ────────────────────────────────────────────────────
// Para adicionar nova permissão no futuro:
// 1. Adiciona o nome aqui em PERMISSIONS
// 2. Usa can('nova_permissao') em qualquer componente

export type UserRole = 'admin' | 'manager' | 'seller'

export type Permission =
  // Financeiro — dados sensíveis
  | 'view_margins'           // Ver % de margem real
  | 'view_costs'             // Ver página Custos Operacionais
  | 'view_cost_per_unit'     // Ver custo por urna nos produtos
  | 'view_freight_cost'      // Ver custo de frete nas cargas
  // Configurações e sistema
  | 'manage_settings'        // Acessar Configurações
  | 'manage_integrations'    // Acessar Integrações
  | 'manage_users'           // Gerenciar usuários
  | 'manage_margin_targets'  // Editar metas de margem
  // Operacional
  | 'view_reports'           // Ver Relatórios
  | 'manage_campaigns'       // Criar/disparar Campanhas
  | 'view_all_sellers'       // Ver pedidos de todos os vendedores
  | 'delete_records'         // Excluir registros

const PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'view_margins',
    'view_costs',
    'view_cost_per_unit',
    'view_freight_cost',
    'manage_settings',
    'manage_integrations',
    'manage_users',
    'manage_margin_targets',
    'view_reports',
    'manage_campaigns',
    'view_all_sellers',
    'delete_records',
  ],
  manager: [
    'view_margins',
    'view_costs',
    'view_cost_per_unit',
    'view_freight_cost',
    'manage_margin_targets',
    'view_reports',
    'manage_campaigns',
    'view_all_sellers',
  ],
  seller: [
    'view_reports',
    'manage_campaigns',
  ],
}

export function can(role: UserRole, permission: Permission): boolean {
  return PERMISSIONS[role]?.includes(permission) ?? false
}

export function getPermissions(role: UserRole): Permission[] {
  return PERMISSIONS[role] ?? []
}

// ── Indicadores de margem ──────────────────────────────────────────────────
export type MarginLevel = 'good' | 'low' | 'critical'

export interface MarginTargets {
  order_good: number  // % acima = verde
  order_low: number   // % acima = amarelo, abaixo = vermelho
  load_good: number
  load_low: number
}

export const DEFAULT_TARGETS: MarginTargets = {
  order_good: 30,
  order_low: 15,
  load_good: 20,
  load_low: 8,
}

export function getMarginLevel(
  pct: number,
  type: 'order' | 'load',
  targets: MarginTargets = DEFAULT_TARGETS
): MarginLevel {
  const good = type === 'order' ? targets.order_good : targets.load_good
  const low  = type === 'order' ? targets.order_low  : targets.load_low
  if (pct >= good) return 'good'
  if (pct >= low)  return 'low'
  return 'critical'
}

export const MARGIN_COLORS: Record<MarginLevel, { color: string; bg: string; label: string; emoji: string }> = {
  good:     { color: '#2F6F5D', bg: '#EBF5F1', label: 'Boa margem',    emoji: '🟢' },
  low:      { color: '#B45309', bg: '#FEF3C7', label: 'Margem baixa',  emoji: '🟡' },
  critical: { color: '#DC2626', bg: '#FEE2E2', label: 'Margem crítica', emoji: '🔴' },
}

// ── Itens da sidebar com permissão ────────────────────────────────────────
export interface NavItem {
  href: string
  label: string
  permission?: Permission  // undefined = visível para todos
}

export const NAV_ITEMS_OPERATION: NavItem[] = [
  { href: '/campanhas',          label: 'Campanhas' },
  { href: '/whatsapp',           label: 'WhatsApp Inbox' },
  { href: '/cargas',             label: 'Cargas' },
  { href: '/propostas',          label: 'Pedidos de Venda' },
  { href: '/custos-operacionais',label: 'Custos Operacionais', permission: 'view_costs' },
  { href: '/atendimentos',       label: 'Atendimentos' },
  { href: '/tarefas',            label: 'Tarefas' },
]

export const NAV_ITEMS_SYSTEM: NavItem[] = [
  { href: '/relatorios',   label: 'Relatórios' },
  { href: '/integracoes',  label: 'Integrações',  permission: 'manage_integrations' },
  { href: '/configuracoes',label: 'Configurações', permission: 'manage_settings' },
]
