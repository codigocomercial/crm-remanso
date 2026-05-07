'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/rm-components'
import { Upload, ImageOff, ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'

const CATEGORIAS = ['Econômica', 'Intermediária', 'Luxo', 'Super Luxo', 'Infantil', 'Especial']
const MATERIAIS = ['MDF', 'Madeira', 'Compensado', 'Pinus', 'Eucalipto']

const ORG_ID = '402dff70-cbd7-4f5a-9f73-5cdfbd2e98e2'

export default function EditarProdutoPage() {
    const router = useRouter()
    const { id } = useParams<{ id: string }>()
    const supabase = createClient()

    const [loading, setLoading] = useState(true)
    const [modelos, setModelos] = useState<{ code: string; name: string; category: string | null }[]>([])
    const [alcas, setAlcas] = useState<{ name: string }[]>([])
    const [cores, setCores] = useState<{ name: string }[]>([])
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [imageUrl, setImageUrl] = useState<string | null>(null)

    // Dados do Bling — somente leitura
    const [blingData, setBlingData] = useState<{
        name: string; sku: string | null; category: string | null
        price: number | null; cost_price: number | null
        stock_quantity: number | null; is_active: boolean; bling_id: number | null
    } | null>(null)

    const [form, setForm] = useState({
        modelo: '', description: '', alca: '', cor: '',
        is_active: true, sort_order: '0',
    })

    useEffect(() => {
        loadProduct()
        Promise.all([
            supabase.from('product_models').select('code, name, category').eq('org_id', ORG_ID).eq('is_active', true).order('sort_order'),
            supabase.from('product_alcas').select('name').eq('org_id', ORG_ID).eq('is_active', true).order('sort_order'),
            supabase.from('product_cores').select('name').eq('org_id', ORG_ID).eq('is_active', true).order('sort_order'),
        ]).then(([{ data: m }, { data: a }, { data: c }]) => {
            setModelos(m ?? [])
            setAlcas(a ?? [])
            setCores(c ?? [])
        })
    }, [id])

    async function loadProduct() {
        setLoading(true)
        const { data } = await supabase.from('products').select('*').eq('id', id).single()
        if (data) {
            setBlingData({
                name: data.name ?? '',
                sku: data.sku ?? null,
                category: data.category ?? null,
                price: data.price ?? null,
                cost_price: data.cost_price ?? null,
                stock_quantity: data.stock_quantity ?? null,
                is_active: data.is_active ?? true,
                bling_id: data.bling_id ?? null,
            })
            setForm({
                modelo: data.modelo ?? '',
                description: data.description ?? '',
                alca: data.alca ?? '',
                cor: data.cor ?? '',
                is_active: data.is_active ?? true,
                sort_order: data.sort_order ? String(data.sort_order) : '0',
            })
            setImageUrl(data.image_url)
            setImagePreview(data.image_url)
        }
        setLoading(false)
    }

    function handleModeloChange(code: string) {
        setForm(prev => ({ ...prev, modelo: code }))
    }

    function set(field: string, value: string | boolean) {
        setForm(prev => ({ ...prev, [field]: value }))
    }

    async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = ev => setImagePreview(ev.target?.result as string)
        reader.readAsDataURL(file)
        setUploading(true)
        const ext = file.name.split('.').pop()
        const fileName = `${Date.now()}.${ext}`
        const { data, error } = await supabase.storage
            .from('produtos').upload(fileName, file, { upsert: true })
        if (!error && data) {
            const { data: urlData } = supabase.storage.from('produtos').getPublicUrl(data.path)
            setImageUrl(urlData.publicUrl)
        }
        setUploading(false)
    }

    async function handleSave() {
        setSaving(true)
        const { error } = await supabase.from('products').update({
            modelo: form.modelo.trim() || null,
            description: form.description.trim() || null,
            image_url: imageUrl,
            alca: form.alca.trim() || null,
            cor: form.cor.trim() || null,
            is_active: form.is_active,
            sort_order: parseInt(form.sort_order) || 0,
            updated_at: new Date().toISOString(),
        }).eq('id', id)
        setSaving(false)
        if (!error) router.push('/produtos')
        else alert('Erro ao salvar: ' + error.message)
    }

    const inputClass = "w-full px-3 py-2 text-[13px] rounded-lg border outline-none transition-all"
    const inputStyle = { borderColor: 'rgba(0,0,0,0.1)' }
    const onFocus = (e: any) => e.currentTarget.style.borderColor = 'var(--brand-teal)'
    const onBlur = (e: any) => e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)'

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'var(--brand-teal)', borderTopColor: 'transparent' }} />
        </div>
    )

    return (
        <div className="animate-fade-in max-w-2xl">
            <PageHeader title="Editar Produto" subtitle={blingData?.name || ''}>
                <Link href="/produtos"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-semibold hover:bg-neutral-100 transition-colors"
                    style={{ color: 'var(--neutral-500)' }}>
                    <ArrowLeft size={13} /> Voltar
                </Link>
            </PageHeader>

            <div className="space-y-4">
                {/* Upload foto */}
                <div className="rm-card">
                    <p className="text-[11px] font-semibold uppercase tracking-wide mb-3"
                        style={{ color: 'var(--neutral-500)' }}>Foto do produto</p>
                    <div className="flex items-start gap-4">
                        <div className="w-40 h-40 rounded-xl flex-shrink-0 overflow-hidden"
                            style={{ background: 'var(--neutral-100)', border: '1.5px dashed var(--neutral-300)' }}>
                            {imagePreview ? (
                                <img src={imagePreview} alt="preview" className="w-full h-full object-contain p-2" />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                                    <ImageOff size={24} style={{ color: 'var(--neutral-300)' }} />
                                    <span className="text-[10px]" style={{ color: 'var(--neutral-300)' }}>Sem foto</span>
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="btn-remanso cursor-pointer inline-flex">
                                {uploading ? (
                                    <><div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" /> Enviando...</>
                                ) : (
                                    <><Upload size={13} /> Trocar foto</>
                                )}
                                <input type="file" accept="image/*" className="hidden"
                                    onChange={handleImageUpload} disabled={uploading} />
                            </label>
                            {imageUrl && (
                                <p className="text-[11px] mt-2 font-medium" style={{ color: 'var(--brand-teal)' }}>
                                    ✓ Foto salva
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Informações */}
                <div className="rm-card space-y-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--neutral-500)' }}>Informações do Bling (somente leitura)</p>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Nome — somente leitura */}
                        <div className="col-span-2">
                            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-500)' }}>
                                Nome do produto
                            </label>
                            <div className="px-3 py-2 text-[13px] rounded-lg"
                                style={{ background: 'var(--neutral-100)', color: 'var(--neutral-700)', border: '1px solid var(--neutral-200)' }}>
                                {blingData?.name || '—'}
                            </div>
                        </div>

                        {/* SKU — somente leitura */}
                        <div>
                            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-500)' }}>
                                Código SKU
                            </label>
                            <div className="px-3 py-2 text-[13px] rounded-lg"
                                style={{ background: 'var(--neutral-100)', color: 'var(--neutral-700)', border: '1px solid var(--neutral-200)' }}>
                                {blingData?.sku || '—'}
                            </div>
                        </div>

                        {/* Linha de Produto — somente leitura */}
                        <div>
                            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-500)' }}>
                                Linha de Produto
                            </label>
                            <div className="px-3 py-2 text-[13px] rounded-lg"
                                style={{ background: 'var(--neutral-100)', color: 'var(--neutral-700)', border: '1px solid var(--neutral-200)' }}>
                                {blingData?.category || '—'}
                            </div>
                        </div>

                        {/* Preço — somente leitura */}
                        <div>
                            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-500)' }}>
                                Preço de venda
                            </label>
                            <div className="px-3 py-2 text-[13px] rounded-lg font-semibold"
                                style={{ background: 'var(--neutral-100)', color: 'var(--neutral-700)', border: '1px solid var(--neutral-200)' }}>
                                {blingData?.price ? `R$ ${blingData.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                            </div>
                        </div>

                        {/* Custo — somente leitura */}
                        <div>
                            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-500)' }}>
                                Preço de custo
                            </label>
                            <div className="px-3 py-2 text-[13px] rounded-lg"
                                style={{ background: 'var(--neutral-100)', color: 'var(--neutral-700)', border: '1px solid var(--neutral-200)' }}>
                                {blingData?.cost_price ? `R$ ${blingData.cost_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                            </div>
                        </div>

                        {/* Estoque — somente leitura */}
                        <div>
                            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-500)' }}>
                                Estoque
                            </label>
                            <div className="px-3 py-2 text-[13px] rounded-lg font-semibold"
                                style={{ background: 'var(--neutral-100)', border: '1px solid var(--neutral-200)',
                                    color: (blingData?.stock_quantity ?? 0) > 0 ? 'var(--brand-teal)' : 'var(--color-danger)' }}>
                                {blingData?.stock_quantity ?? 0} un
                            </div>
                        </div>
                    </div>
                </div>

                {/* Campos editáveis */}
                <div className="rm-card space-y-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--neutral-500)' }}>Informações do produto</p>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-700)' }}>
                                Modelo
                            </label>
                            <select value={form.modelo} onChange={e => set('modelo', e.target.value)}
                                className={inputClass + ' bg-white'} style={inputStyle} onFocus={onFocus} onBlur={onBlur}>
                                <option value="">Selecionar modelo...</option>
                                {modelos.map(m => (
                                    <option key={m.code} value={m.code}>{m.code}</option>
                                ))}
                            </select>
                        </div>

                        {/* Alça */}
                        <div>
                            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-700)' }}>
                                🔧 Alça
                            </label>
                            <select value={form.alca} onChange={e => set('alca', e.target.value)}
                                className={inputClass + ' bg-white'} style={inputStyle} onFocus={onFocus} onBlur={onBlur}>
                                <option value="">Selecionar alça...</option>
                                {alcas.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                            </select>
                        </div>

                        {/* Cor */}
                        <div>
                            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-700)' }}>
                                🎨 Cor / Sobreamento
                            </label>
                            <select value={form.cor} onChange={e => set('cor', e.target.value)}
                                className={inputClass + ' bg-white'} style={inputStyle} onFocus={onFocus} onBlur={onBlur}>
                                <option value="">Selecionar cor...</option>
                                {cores.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-700)' }}>
                                Ordem de exibição
                            </label>
                            <input type="number" value={form.sort_order}
                                onChange={e => set('sort_order', e.target.value)}
                                className={inputClass} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-700)' }}>
                                Descrição
                            </label>
                            <textarea rows={3} placeholder="Acabamentos, acessórios incluídos..."
                                value={form.description} onChange={e => set('description', e.target.value)}
                                className={inputClass + ' resize-none'} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                        </div>

                        <div className="col-span-2 flex items-center gap-3">
                            <button type="button" onClick={() => set('is_active', !form.is_active)}
                                className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
                                style={{ background: form.is_active ? 'var(--brand-teal)' : 'var(--neutral-300)' }}>
                                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.is_active ? 'left-5' : 'left-0.5'}`} />
                            </button>
                            <span className="text-[13px] font-semibold" style={{ color: 'var(--neutral-700)' }}>
                                {form.is_active ? 'Visível para a Laura' : 'Oculto para a Laura'}
                            </span>
                        </div>
                    </div>
                </div>

                <button onClick={handleSave} disabled={saving || uploading}
                    className="btn-remanso w-full justify-center py-3 text-[14px]">
                    {saving ? (
                        <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Salvando...</>
                    ) : (
                        <><Save size={14} /> Salvar alterações</>
                    )}
                </button>
            </div>
        </div>
    )
}