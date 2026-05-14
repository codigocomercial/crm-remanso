'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Bell, Search, Menu, X, Sun, Moon } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { useTheme } from '@/app/providers'
import { cn } from '@/lib/utils'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/pipeline': 'Pipeline',
  '/clientes': 'Clientes',
  '/recompra': 'Painel de Recompra',
  '/campanhas': 'Campanhas',
  '/atendimentos': 'Atendimentos',
  '/whatsapp': 'WhatsApp Inbox',
  '/cargas': 'Gerenciador de Cargas',
  '/tarefas': 'Tarefas',
  '/empresas': 'Empresas',
  '/produtos': 'Produtos',
  '/relatorios': 'Relatórios',
  '/integracoes': 'Integrações',
  '/configuracoes': 'Configurações',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const { theme, toggleTheme } = useTheme()

  const title = Object.entries(PAGE_TITLES)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([key]) => pathname === key || pathname.startsWith(key + '/'))
    ?.[1] ?? 'CRM'

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--surface-bg, var(--neutral-100))' }}>

      {/* ── Sidebar desktop (fixa) ── */}
      <div className="hidden lg:flex flex-shrink-0 h-full">
        <Sidebar />
      </div>

      {/* ── Sidebar mobile (overlay) ── */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed left-0 top-0 h-full z-50 lg:hidden">
            <div className="relative h-full">
              <Sidebar mobile onClose={() => setMobileOpen(false)} />
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-3 p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10"
                style={{ color: 'var(--neutral-500)' }}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Conteúdo principal ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── Topbar ── */}
        <header
          className="flex-shrink-0 border-b flex items-center px-5 gap-3"
          style={{
            height: '56px',
            backgroundColor: 'var(--surface-sidebar, #FFFFFF)',
            borderColor: 'var(--surface-border, #E5E7EB)',
          }}
        >
          {/* Menu mobile */}
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-1.5 rounded-lg"
            style={{ color: 'var(--neutral-500)' }}
          >
            <Menu size={18} />
          </button>

          {/* Busca */}
          <div className="flex-1 max-w-sm">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--neutral-300)' }}
              />
              <input
                type="text"
                placeholder="Buscar clientes, pedidos..."
                className="w-full pl-8 pr-4 py-1.5 text-[13px] rounded-lg border outline-none transition-all bg-[var(--neutral-100)] border-black/[0.08] dark:border-white/[0.08] text-[var(--neutral-900)]"
                onFocus={e => {
                  e.currentTarget.style.borderColor = 'var(--brand-teal)'
                  e.currentTarget.style.backgroundColor = 'var(--neutral-50)'
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = ''
                  e.currentTarget.style.backgroundColor = ''
                }}
              />
            </div>
          </div>

          {/* Sino + toggle tema + avatar */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              className="relative w-8 h-8 rounded-lg flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors"
              style={{ color: 'var(--neutral-500)' }}
            >
              <Bell size={16} />
            </button>

            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors"
              style={{ color: 'var(--neutral-500)' }}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black text-white"
              style={{ backgroundColor: 'var(--brand-teal)' }}
            >
              UR
            </div>
          </div>
        </header>

        {/* ── Conteúdo da página ── */}
        <main className="flex-1 overflow-y-auto p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  )
}