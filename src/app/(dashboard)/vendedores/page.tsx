'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Search, UserCheck, Loader2 } from 'lucide-react'

type Seller = {
    id: string
    name: string
    email: string | null
    phone: string | null
    is_active: boolean
    bling_id: number | null
}

export default function VendedoresPage() {
    const supabase = createClient()
    const [sellers, setSellers] = useState<Seller[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    const fetchSellers = useCallback(async () => {
        setLoading(true)
        const { data } = await supabase.from('sellers').select('*').order('name')
        setSellers(data ?? [])
        setLoading(false)
    }, [supabase])

    useEffect(() => { fetchSellers() }, [fetchSellers])

    const filtered = sellers.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Vendedores</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Equipe comercial da Urnas Remanso</p>
            </div>

            <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar vendedor..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9"
                />
            </div>

            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                <div className="hidden sm:grid grid-cols-[2fr_2fr_1.5fr_1fr] gap-4 px-6 py-3 border-b border-border bg-muted/40">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nome</span>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</span>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Telefone</span>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</span>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-primary opacity-50" />
                        <p className="text-sm text-muted-foreground">Carregando vendedores...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-2">
                        <UserCheck className="w-10 h-10 text-muted-foreground/30" />
                        <p className="text-lg font-medium text-foreground">Nenhum vendedor encontrado</p>
                        <p className="text-sm text-muted-foreground">Sincronize o Bling na página de Empresas</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {filtered.map(s => (
                            <div key={s.id} className="grid grid-cols-[2fr_2fr_1.5fr_1fr] gap-4 px-6 py-4 hover:bg-muted/30 transition-colors items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                        style={{ backgroundColor: '#3E8F76' }}>
                                        {s.name.slice(0, 2).toUpperCase()}
                                    </div>
                                    <span className="font-medium text-foreground truncate">{s.name}</span>
                                </div>
                                <span className="text-sm text-muted-foreground truncate">{s.email ?? '—'}</span>
                                <span className="text-sm text-muted-foreground">{s.phone ?? '—'}</span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border w-fit ${s.is_active ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                    {s.is_active ? 'Ativo' : 'Inativo'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}