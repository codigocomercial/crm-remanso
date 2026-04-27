'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/rm-components'
import { Upload, ImageOff, ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'

const CATEGORIAS = ['Econômica', 'Intermediária', 'Luxo', 'Super Luxo', 'Infantil', 'Especial']
const MATERIAIS = ['MDF', 'Madeira', 'Compensado', 'Pinus', 'Eucalipto']

export default function EditarProdutoPage() {
    const router = useRouter()
    const { id } = useParams<{ id: string }>()
    const supabase = createClient()

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [imageUrl, setImageUrl] = useState<string | null>(null)

    const [form, setForm] = useState({
        name: '', sku: '', modelo: '', description: '', price: '',
        category: '', material: '', alca: '', cor: '',
        dimensions: '', is_active: true, sort_order: '0',
    })

    useEffect(() => { loadProduct() }, [id])

    async function loadProduct() {
        setLoading(true)
        const { data } = await supabase.from('products').select('*').eq('id', id).single()
        if (data) {
            setForm({
                name: data.name ?? '',
                sku: data.sku ?? '',
                modelo: data.modelo ?? '',
                description: data.description ?? '',
                price: data.price ? String(data.price) : '',
                category: data.category ?? '',
                material: data.material ?? '',
                alca: data.alca ?? '',
                cor: data.cor ?? '',
                dimensions: data.dimensions ?? '',
                is_active: data.is_active ?? true,
                sort_order: data.sort_order ? String(data.sort_order) : '0',
            })
            setImageUrl(data.image_url)
            setImagePreview(data.image_url)
        }
        setLoading(false)
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
        if (!form.name.trim()) { alert('Nome obrigatório'); return }
        setSaving(true)
        const { error } = await supabase.from('products').update({
            name: form.name.trim(),
            sku: form.sku.trim() || null,
            modelo: form.modelo.trim() || null,
            description: form.description.trim() || null,
            price: form.price ? parseFloat(form.price) : null,
            image_url: imageUrl,
            category: form.category || null,
            material: form.material || null,
            alca: form.alca.trim() || null,
            cor: form.cor.trim() || null,
            dimensions: form.dimensions.trim() || null,
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
            <PageHeader title="Editar Produto" subtitle={form.name}>
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
                        style={{ color: 'var(--neutral-500)' }}>Informações</p>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-700)' }}>
                                Nome do produto *
                            </label>
                            <input type="text" placeholder="Ex: Urna Linha Luxo" value={form.name}
                                onChange={e => set('name', e.target.value)}
                                className={inputClass} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                        </div>

                        <div>
                            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-700)' }}>
                                Código SKU
                            </label>
                            <input type="text" placeholder="Ex: URN-R100-OCR" value={form.sku}
                                onChange={e => set('sku', e.target.value)}
                                className={inputClass} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                        </div>

                        <div>
                            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-700)' }}>
                                Modelo
                            </label>
                            <input type="text" placeholder="Ex: R300, R500" value={form.modelo}
                                onChange={e => set('modelo', e.target.value)}
                                className={inputClass} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                        </div>

                        <div>
                            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-700)' }}>
                                Preço (R$)
                            </label>
                            <input type="number" placeholder="0,00" value={form.price}
                                onChange={e => set('price', e.target.value)}
                                className={inputClass} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                        </div>

                        {/* Alça */}
                        <div>
                            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-700)' }}>
                                🔧 Alça
                            </label>
                            <input type="text" placeholder="Ex: Varão Roma Metalizada" value={form.alca}
                                onChange={e => set('alca', e.target.value)}
                                className={inputClass} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                        </div>

                        {/* Cor */}
                        <div>
                            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-700)' }}>
                                🎨 Cor / Sobreamento
                            </label>
                            <input type="text" placeholder="Ex: Ocre/Mogno, Mogno/Imbuia" value={form.cor}
                                onChange={e => set('cor', e.target.value)}
                                className={inputClass} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                        </div>

                        <div>
                            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-700)' }}>
                                Categoria
                            </label>
                            <select value={form.category} onChange={e => set('category', e.target.value)}
                                className={inputClass + ' bg-white'} style={inputStyle} onFocus={onFocus} onBlur={onBlur}>
                                <option value="">Selecionar...</option>
                                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-700)' }}>
                                Material
                            </label>
                            <select value={form.material} onChange={e => set('material', e.target.value)}
                                className={inputClass + ' bg-white'} style={inputStyle} onFocus={onFocus} onBlur={onBlur}>
                                <option value="">Selecionar...</option>
                                {MATERIAIS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--neutral-700)' }}>
                                Dimensões
                            </label>
                            <input type="text" placeholder="Ex: 190x60x40cm" value={form.dimensions}
                                onChange={e => set('dimensions', e.target.value)}
                                className={inputClass} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
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
                                {form.is_active ? 'Produto ativo (visível para a Laura)' : 'Produto inativo'}
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