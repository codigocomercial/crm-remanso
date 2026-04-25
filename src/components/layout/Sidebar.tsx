'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
    LayoutDashboard, KanbanSquare, Users, Building2,
    MessageSquare, CheckSquare, BarChart2, Settings,
    Zap, Megaphone, RefreshCw, Package,
} from 'lucide-react'

/* ── Logo SVG inline — mãos em oração Remanso ── */
function LogoMaos({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
            <ellipse cx="18" cy="16" rx="11" ry="13" stroke="white" strokeWidth="1.8" fill="none" opacity="0.9" />
            <line x1="15" y1="10" x2="15" y2="26" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="18" y1="8" x2="18" y2="26" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="21" y1="10" x2="21" y2="26" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M13 26 C13 23 23 23 23 26" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
    )
}

const NAV = [
    {
        section: 'Principal',
        items: [
            { href: '/', label: 'Dashboard', icon: LayoutDashboard },
            { href: '/pipeline', label: 'Pipeline', icon: KanbanSquare },
            { href: '/clientes', label: 'Clientes', icon: Users },
            { href: '/recompra', label: 'Recompra', icon: RefreshCw, badge: 'warn' },
        ],
    },
    {
        section: 'Operação',
        items: [
            { href: '/campanhas', label: 'Campanhas', icon: Megaphone },
            { href: '/atendimentos', label: 'Atendimentos', icon: MessageSquare },
            { href: '/tarefas', label: 'Tarefas', icon: CheckSquare },
            { href: '/empresas', label: 'Empresas', icon: Building2 },
            { href: '/produtos', label: 'Produtos', icon: Package },
        ],
    },
    {
        section: 'Sistema',
        items: [
            { href: '/relatorios', label: 'Relatórios', icon: BarChart2 },
            { href: '/integracoes', label: 'Integrações', icon: Zap },
            { href: '/configuracoes', label: 'Configurações', icon: Settings },
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

    return (
        <aside
            className={cn(
                'h-full bg-white border-r flex flex-col',
                'w-[216px]',
                mobile ? 'shadow-xl' : ''
            )}
            style={{ borderColor: 'rgba(0,0,0,0.07)' }}
        >
            {/* ── Logo ── */}
            <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'var(--brand-teal)' }}
                >
                    <LogoMaos className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-[13px] font-black tracking-wide leading-tight"
                        style={{ fontFamily: 'Montserrat, sans-serif', color: 'var(--neutral-900)' }}>
                        REMANSO
                    </p>
                    <p className="text-[9px] font-bold tracking-[1.5px] uppercase"
                        style={{ color: 'var(--brand-teal)' }}>
                        URNAS · CRM
                    </p>
                </div>
            </div>

            {/* ── Navegação ── */}
            <nav className="flex-1 overflow-y-auto px-2.5 py-3">
                {NAV.map(({ section, items }) => (
                    <div key={section} className="mb-2">
                        <p className="text-[9px] font-bold uppercase tracking-[1.5px] px-2.5 py-1.5"
                            style={{ color: 'var(--neutral-300)' }}>
                            {section}
                        </p>
                        {items.map(({ href, label, icon: Icon, badge }) => {
                            const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
                            const showBadge = href === '/recompra' && recompraBadge > 0

                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    onClick={onClose}
                                    className={cn('nav-item', isActive && 'active')}
                                >
                                    <Icon
                                        size={14}
                                        className="flex-shrink-0"
                                        style={{ color: isActive ? 'var(--brand-teal)' : 'var(--neutral-300)' }}
                                    />
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
                ))}
            </nav>

            {/* ── Usuário ── */}
            <div className="px-3 py-3 border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black text-white flex-shrink-0"
                        style={{ backgroundColor: 'var(--brand-teal)' }}>
                        {userName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold truncate" style={{ color: 'var(--neutral-900)' }}>{userName}</p>
                        <p className="text-[10px] truncate" style={{ color: 'var(--neutral-500)' }}>{userEmail}</p>
                    </div>
                </div>
            </div>
        </aside>
    )
}