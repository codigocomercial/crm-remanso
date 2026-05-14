'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUserRole } from '@/hooks/useUserRole'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/rm-components'
import { Plus, Search, Package, Edit2, Trash2, ImageOff, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react'
import Link from 'next/link'

const ORG_ID = '402dff70-cbd7-4f5a-9f73-5cdfbd2e98e2'

interface Product {
    id: string
    name: string
    modelo: string | null
    description: string | null
    price: number | null
    image_url: string | null
    category: string | null
    alca: string | null
    sku: string | null
    cor: string | null
    is_active: boolean
    cost_price: number | null
    stock_quantity: number | null
    bling_id: number | null
    sort_order: number
}

export default function ProdutosPage() {
  const { can } = useUserRole()
    const router = useRouter()
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [deleting, setDeleting] = useState<string | null>(null)
    const [syncing, setSyncing] = useState(false)
    const [syncMsg, setSyncMsg] = useState('')
    const supabase = createClient()

    useEffect(() => { load('') }, [])

    useEffect(() => {
        const t = setTimeout(() => load(search), 350)
        return () => clearTimeout(t)
    }, [search])

    async function load(q: string) {
        setLoading(true)
        let query = supabase
            .from('products')
            .select('*')
            .eq('org_id', ORG_ID)
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true })
            .limit(500)

        if (q.trim()) {
            query = query.or(
                `name.ilike.%${q}%,modelo.ilike.%${q}%,sku.ilike.%${q}%,category.ilike.%${q}%`
            )
        }

        const { data } = await query
        setProducts(data ?? [])
        setLoading(false)
    }

    async function toggleActive(product: Product) {
        await supabase.from('products').update({ is_active: !product.is_active }).eq('id', product.id)
        setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_active: !p.is_active } : p))
    }

    async function deleteProduct(id: string) {
        if (!confirm('Tem certeza que deseja excluir este produto?')) return
        setDeleting(id)
        await supabase.from('products').delete().eq('id', id)
        setProducts(prev => prev.filter(p => p.id !== id))
        setDeleting(null)
    }

    const filtered = products

    return (
        <div className="animate-fade-in">
      <div className="sticky top-0 z-20 pb-2" style={{ backdropFilter: "blur(8px)" }}>
            <PageHeader title="Produtos" subtitle={search ? `${products.length} resultado(s) para "${search}"` : `${products.length} urnas cadastradas`}>
                <button onClick={async () => {
                    setSyncing(true)
                    setSyncMsg('')
                    try {
                      const res = await fetch('/api/bling/sync/produtos', { method: 'POST' })
                      const data = await res.json()
                      if (data.success) {
                        setSyncMsg('Sincronizando... recarregando em 15s')
                        setTimeout(() => { load(search); setSyncMsg('') }, 15000)
                      } else {
                        setSyncMsg('Erro: ' + data.error)
                      }
                    } finally {
                      setSyncing(false)
                    }
                }} disabled={syncing} className="btn-remanso-outline mr-2 flex items-center gap-1.5">
                    <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
                    {syncing ? 'Sincronizando...' : 'Sincronizar Bling'}
                </button>
                <Link href="/produtos/novo" className="btn-remanso">
                    <Plus size={13} /> Novo produto
                </Link>
            </PageHeader>
            {syncMsg && (
              <div className="mb-3 px-4 py-2 rounded-lg text-[12px] font-medium"
                style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--brand-teal)' }}>
                ✓ {syncMsg}
              </div>
            )}

            {/* Busca */}
            <div className="rm-card mb-5">
                <div className="relative max-w-sm">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--neutral-300)' }} />
                    <input type="text" placeholder="Buscar por nome, modelo..."
                        value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-[13px] rounded-lg border outline-none"
                        style={{ borderColor: 'rgba(0,0,0,0.08)', backgroundColor: 'var(--neutral-100)' }}
                        onFocus={e => { e.currentTarget.style.borderColor = 'var(--brand-teal)'; e.currentTarget.style.backgroundColor = 'white' }}
                        onBlur={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; e.currentTarget.style.backgroundColor = 'var(--neutral-100)' }}
                    />
                </div>
            </div>

            {/* Grid */}
            </div>

      {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="rm-card animate-pulse h-64" style={{ background: 'var(--neutral-100)' }} />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="rm-card flex flex-col items-center justify-center py-16 text-center">
                    <Package size={40} className="mb-4" style={{ color: 'var(--neutral-300)' }} />
                    <p className="text-[15px] font-semibold mb-1" style={{ color: 'var(--neutral-700)' }}>
                        {search ? 'Nenhum produto encontrado' : 'Nenhuma urna cadastrada ainda'}
                    </p>
                    <p className="text-[13px] mb-5" style={{ color: 'var(--neutral-500)' }}>
                        {search ? 'Tente outro termo' : 'Cadastre os modelos do catálogo'}
                    </p>
                    {!search && (
                        <Link href="/produtos/novo" className="btn-remanso">
                            <Plus size={13} /> Cadastrar primeira urna
                        </Link>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filtered.map(product => (
                        <div key={product.id}
                            className="rm-card p-0 overflow-hidden group transition-all"
                            style={{ opacity: product.is_active ? 1 : 0.55 }}>

                            {/* Imagem */}
                            <div className="relative overflow-hidden bg-white" style={{ height: '180px' }}>
                                {product.image_url ? (
                                    <img src={product.image_url} alt={product.name}
                                        className="w-full h-full object-contain p-2 transition-transform group-hover:scale-105" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center gap-2"
                                        style={{ background: 'var(--neutral-100)' }}>
                                        <ImageOff size={28} style={{ color: 'var(--neutral-300)' }} />
                                        <span className="text-[11px]" style={{ color: 'var(--neutral-300)' }}>Sem foto</span>
                                    </div>
                                )}

                                {/* Badge ativo */}
                                <div className="absolute top-2 left-2">
                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                                        style={{
                                            background: product.is_active ? '#EBF5F1' : '#F1F5F9',
                                            color: product.is_active ? '#2F6F5D' : '#9CA3AF'
                                        }}>
                                        {product.is_active ? 'Ativo' : 'Inativo'}
                                    </span>
                                </div>

                                {/* Ações hover */}
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Link href={`/produtos/${product.id}/editar`}
                                        className="w-7 h-7 rounded-lg flex items-center justify-center bg-white shadow-sm hover:bg-neutral-50"
                                        title="Editar">
                                        <Edit2 size={12} style={{ color: 'var(--neutral-700)' }} />
                                    </Link>
                                    <button onClick={() => toggleActive(product)}
                                        className="w-7 h-7 rounded-lg flex items-center justify-center bg-white shadow-sm hover:bg-neutral-50"
                                        title={product.is_active ? 'Desativar' : 'Ativar'}>
                                        {product.is_active
                                            ? <ToggleRight size={12} style={{ color: 'var(--brand-teal)' }} />
                                            : <ToggleLeft size={12} style={{ color: 'var(--neutral-500)' }} />}
                                    </button>
                                    <button onClick={() => deleteProduct(product.id)}
                                        disabled={deleting === product.id}
                                        className="w-7 h-7 rounded-lg flex items-center justify-center bg-white shadow-sm hover:bg-red-50"
                                        title="Excluir">
                                        <Trash2 size={12} style={{ color: 'var(--color-danger)' }} />
                                    </button>
                                </div>
                            </div>

                            {/* Info */}
                            <div className="p-3 border-t" style={{ borderColor: 'var(--neutral-100)' }}>
                                {/* Modelo — destaque principal */}
                                {product.modelo && (
                                    <p className="text-[18px] font-bold mb-1.5"
                                        style={{ color: 'var(--neutral-900)', letterSpacing: '-0.5px' }}>
                                        {product.modelo}
                                    </p>
                                )}

                                {/* Tags: Alça + Cor */}
                                <div className="flex flex-wrap gap-1 mb-2">
                                    {product.alca && (
                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full truncate max-w-full"
                                            style={{ background: 'var(--brand-teal-soft)', color: 'var(--brand-teal-dark)' }}>
                                            🔧 {product.alca}
                                        </span>
                                    )}
                                    {product.cor && (
                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full truncate max-w-full"
                                            style={{ background: 'var(--brand-gold-bg)', color: 'var(--brand-gold-dark)' }}>
                                            🎨 {product.cor}
                                        </span>
                                    )}
                                    {product.category && (
                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                                            style={{ background: 'var(--neutral-100)', color: 'var(--neutral-500)' }}>
                                            {product.category}
                                        </span>
                                    )}
                                </div>

                                {/* SKU */}
                                {product.sku && (
                                    <p className="text-[11px]" style={{ color: 'var(--neutral-400)' }}>
                                        SKU: {product.sku}
                                    </p>
                                )}

                                {/* Preço venda e custo */}
                                <div className="flex items-center gap-3 mt-1">
                                    {product.price && (
                                        <p className="text-[14px] font-bold"
                                            style={{ color: 'var(--neutral-900)', letterSpacing: '-0.5px' }}>
                                            R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </p>
                                    )}
                                    {product.cost_price && can('view_cost_per_unit') && (
                                        <p className="text-[11px]" style={{ color: 'var(--neutral-400)' }}>
                                            Custo: R$ {product.cost_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </p>
                                    )}
                                </div>

                                {/* Estoque */}
                                {product.stock_quantity !== null && product.bling_id && (
                                    <p className="text-[11px]" style={{ color: product.stock_quantity > 0 ? 'var(--brand-teal)' : 'var(--color-danger)' }}>
                                        Estoque: {product.stock_quantity} un
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}