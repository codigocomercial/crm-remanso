'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useUserRole } from '@/hooks/useUserRole'
import { type Permission } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/client'
import {
    LayoutDashboard, KanbanSquare, Users, Building2,
    MessageSquare, CheckSquare, BarChart2, Settings,
    Zap, Megaphone, RefreshCw, Package, FileText,
    UserCheck, Calculator, MessageCircle, Truck, LogOut,
} from 'lucide-react'

interface NavItem {
    href: string
    label: string
    icon: any
    badge?: string
    permission?: Permission
}

const NAV: { section: string; items: NavItem[] }[] = [
    {
        section: 'Principal',
        items: [
            { href: '/',         label: 'Dashboard',  icon: LayoutDashboard },
            { href: '/pipeline', label: 'Pipeline',   icon: KanbanSquare },
            { href: '/clientes', label: 'Contatos',   icon: Users },
            { href: '/recompra', label: 'Recompra',   icon: RefreshCw, badge: 'warn' },
        ],
    },
    {
        section: 'Operação',
        items: [
            { href: '/campanhas',           label: 'Campanhas',           icon: Megaphone },
            { href: '/whatsapp',            label: 'WhatsApp Inbox',      icon: MessageCircle },
            { href: '/cargas',              label: 'Cargas',              icon: Truck },
            { href: '/propostas',           label: 'Pedidos de Venda',    icon: FileText },
            { href: '/custos-operacionais', label: 'Custos Operacionais', icon: Calculator, permission: 'view_costs' },
            { href: '/atendimentos',        label: 'Atendimentos',        icon: MessageSquare },
            { href: '/tarefas',             label: 'Tarefas',             icon: CheckSquare },
            { href: '/empresas',            label: 'Empresas',            icon: Building2 },
            { href: '/vendedores',          label: 'Vendedores',          icon: UserCheck },
            { href: '/produtos',            label: 'Produtos',            icon: Package },
        ],
    },
    {
        section: 'Sistema',
        items: [
            { href: '/relatorios',   label: 'Relatórios',   icon: BarChart2 },
            { href: '/integracoes',  label: 'Integrações',  icon: Zap,      permission: 'manage_integrations' },
            { href: '/configuracoes',label: 'Configurações',icon: Settings, permission: 'manage_settings' },
        ],
    },
]

interface SidebarProps {
    recompraBadge?: number
    onClose?: () => void
    mobile?: boolean
    userName?: string
    userEmail?: string
}

export function Sidebar({
    recompraBadge = 0,
    onClose,
    mobile = false,
    userName = 'Urnas Remanso',
    userEmail = 'contato@urnasremanso.com.br',
}: SidebarProps) {
    const pathname = usePathname()
    const router = useRouter()
    const { can, role } = useUserRole()

    async function handleLogout() {
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    return (
        <aside
            className={cn(
                'h-full flex flex-col',
                'w-[216px]',
                mobile ? 'shadow-xl' : '',
            )}
            style={{
                backgroundColor: 'var(--surface-sidebar, #FFFFFF)',
                borderRight: '1px solid var(--surface-border, #E5E7EB)',
            }}
        >
            {/* Logo */}
            <div className="flex items-center justify-center px-4 py-4 border-b" style={{ borderColor: 'var(--surface-border)' }}>
                <img
                    src="/remanso-logo.png"
                    alt="Remanso CRM"
                    style={{ width: '148px', height: 'auto', objectFit: 'contain' }}
                />
            </div>

            {/* Navegação */}
            <nav className="flex-1 overflow-y-auto px-2.5 py-3">
                {NAV.map(({ section, items }) => {
                    const visibleItems = items.filter(item =>
                        !item.permission || can(item.permission)
                    )
                    if (visibleItems.length === 0) return null

                    return (
                        <div key={section} className="mb-2">
                            <p className="text-[9px] font-bold uppercase tracking-[1.5px] px-2.5 py-1.5 text-[var(--neutral-300)]">
                                {section}
                            </p>
                            {visibleItems.map(({ href, label, icon: Icon, badge }) => {
                                const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
                                const showBadge = href === '/recompra' && recompraBadge > 0

                                return (
                                    <Link key={href} href={href} onClick={onClose}
                                        className={cn('nav-item', isActive && 'active')}>
                                        <Icon size={14} className="flex-shrink-0"
                                            style={{ color: isActive ? 'var(--brand-teal)' : 'var(--neutral-300)' }} />
                                        <span className="flex-1 truncate">{label}</span>
                                        {showBadge && (
                                            <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                                                style={{ backgroundColor: badge === 'warn' ? 'var(--brand-gold)' : 'var(--brand-teal)' }}>
                                                {recompraBadge}
                                            </span>
                                        )}
                                    </Link>
                                )
                            })}
                        </div>
                    )
                })}
            </nav>

            {/* Usuário + Logout */}
            <div className="px-3 py-3 border-t" style={{ borderColor: 'var(--surface-border)' }}>
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black text-white flex-shrink-0"
                        style={{ backgroundColor: '#3E8F76' }}>
                        {userName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold truncate text-[var(--neutral-800)]">
                            {userName}
                        </p>
                        <p className="text-[10px] truncate text-[var(--neutral-400)]">
                            {userEmail}
                        </p>
                    </div>
                </div>
                {/* Badge de role */}
                <div className="mt-2 flex items-center justify-between">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                        style={{
                            color: role === 'admin' ? '#1D6FA4' : role === 'manager' ? '#2F6F5D' : '#B45309',
                            backgroundColor: role === 'admin' ? '#EBF4FB' : role === 'manager' ? '#EBF5F1' : '#FEF3C7',
                        }}>
                        {role === 'admin' ? 'Administrador' : role === 'manager' ? 'Gerente' : 'Vendedor'}
                    </span>
                    <button
                        onClick={handleLogout}
                        title="Sair"
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-red-50 dark:hover:bg-red-950/40 text-[var(--neutral-400)] hover:text-red-500"
                    >
                        <LogOut size={13} />
                    </button>
                </div>
            </div>
        </aside>
    )
}
