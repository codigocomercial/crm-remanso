'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Megaphone, Plus, Send, Clock, CheckCircle2,
    XCircle, FileImage, Users, BarChart2, Loader2,
    ChevronRight, Calendar, ImageIcon
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Campaign {
    id: string
    name: string
    message_template: string
    media_url: string | null
    status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled'
    scheduled_at: string | null
    sent_count: number
    total_contacts: number
    failed_count: number
    filter_cities: string[] | null
    created_at: string
}

const STATUS_CONFIG = {
    draft: { label: 'Rascunho', color: 'bg-zinc-500/15 text-zinc-400', icon: FileImage },
    scheduled: { label: 'Agendada', color: 'bg-blue-500/15 text-blue-400', icon: Clock },
    sending: { label: 'Enviando', color: 'bg-yellow-500/15 text-yellow-400', icon: Loader2 },
    sent: { label: 'Enviada', color: 'bg-emerald-500/15 text-emerald-400', icon: CheckCircle2 },
    cancelled: { label: 'Cancelada', color: 'bg-red-500/15 text-red-400', icon: XCircle },
}

const ORG_ID = '402dff70-cbd7-4f5a-9f73-5cdfbd2e98e2'

// ─── Campaign Card ────────────────────────────────────────────────────────────

function CampaignCard({ campaign, onSelect }: { campaign: Campaign; onSelect: () => void }) {
    const cfg = STATUS_CONFIG[campaign.status]
    const Icon = cfg.icon
    const progress = campaign.total_contacts > 0
        ? Math.round((campaign.sent_count / campaign.total_contacts) * 100)
        : 0

    return (
        <div
            onClick={onSelect}
            className="bg-card border border-border rounded-2xl p-5 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group"
        >
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {campaign.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
                    <Icon className="w-3 h-3" />
                    {cfg.label}
                </span>
            </div>

            <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                {campaign.message_template}
            </p>

            {campaign.filter_cities && campaign.filter_cities.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                    {campaign.filter_cities.slice(0, 3).map(city => (
                        <span key={city} className="text-[11px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                            📍 {city}
                        </span>
                    ))}
                    {campaign.filter_cities.length > 3 && (
                        <span className="text-[11px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                            +{campaign.filter_cities.length - 3}
                        </span>
                    )}
                </div>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {campaign.total_contacts} contatos
                    </span>
                    <span className="flex items-center gap-1 text-emerald-500">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {campaign.sent_count} enviados
                    </span>
                </div>
                {campaign.status === 'sent' && (
                    <span className="font-semibold text-emerald-500">{progress}%</span>
                )}
                <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {campaign.status === 'sending' && (
                <div className="mt-3">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── New Campaign Dialog ──────────────────────────────────────────────────────

function NewCampaignDialog({
    open,
    onClose,
    onCreated,
}: {
    open: boolean
    onClose: () => void
    onCreated: () => void
}) {
    const [name, setName] = useState('')
    const [message, setMessage] = useState('')
    const [cities, setCities] = useState('')
    const [mediaFile, setMediaFile] = useState<File | null>(null)
    const [mediaPreview, setMediaPreview] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [contactCount, setContactCount] = useState<number | null>(null)

    // Preview de contatos ao digitar cidades
    useEffect(() => {
        const fetchCount = async () => {
            const supabase = createClient()
            const cityList = cities.split(',').map(c => c.trim()).filter(Boolean)
            let query = supabase.from('contacts').select('id', { count: 'exact', head: true })
                .eq('org_id', ORG_ID).eq('status', 'active')

            if (cityList.length > 0) query = query.in('city', cityList)

            const { count } = await query
            setContactCount(count ?? 0)
        }
        fetchCount()
    }, [cities])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setMediaFile(file)
        setMediaPreview(URL.createObjectURL(file))
    }

    const handleSubmit = async () => {
        if (!name || !message) return
        setLoading(true)
        const supabase = createClient()

        let media_url: string | null = null

        // Upload da imagem se houver
        if (mediaFile) {
            const ext = mediaFile.name.split('.').pop()
            const path = `${Date.now()}.${ext}`
            const { data: upload, error: uploadErr } = await supabase.storage
                .from('campanhas')
                .upload(path, mediaFile, { upsert: true })

            if (!uploadErr && upload) {
                const { data: { publicUrl } } = supabase.storage.from('campanhas').getPublicUrl(upload.path)
                media_url = publicUrl
            }
        }

        const cityList = cities.split(',').map(c => c.trim()).filter(Boolean)

        // Buscar contatos filtrados
        let contactQuery = supabase.from('contacts').select('id')
            .eq('org_id', ORG_ID).eq('status', 'active').not('whatsapp', 'is', null)

        if (cityList.length > 0) contactQuery = contactQuery.in('city', cityList)
        const { data: contactsData } = await contactQuery

        // Criar campanha
        const { data: campaign, error } = await supabase.from('campaigns').insert({
            org_id: ORG_ID,
            name,
            message_template: message,
            media_url,
            status: 'draft',
            filter_cities: cityList.length > 0 ? cityList : null,
            total_contacts: contactsData?.length ?? 0,
        }).select('id').single()

        if (!error && campaign && contactsData) {
            // Inserir campaign_contacts
            const rows = contactsData.map(c => ({
                campaign_id: campaign.id,
                contact_id: c.id,
                status: 'pending',
            }))
            if (rows.length > 0) {
                await supabase.from('campaign_contacts').insert(rows)
            }
        }

        setLoading(false)
        onCreated()
        onClose()
        setName('')
        setMessage('')
        setCities('')
        setMediaFile(null)
        setMediaPreview(null)
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Megaphone className="w-5 h-5 text-primary" />
                        Nova Campanha
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div>
                        <Label>Nome da campanha</Label>
                        <Input
                            placeholder="Ex: Promoção Quinzenal — Kit Bronze"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="mt-1.5"
                        />
                    </div>

                    <div>
                        <Label>Mensagem</Label>
                        <p className="text-xs text-muted-foreground mb-1.5">
                            Use <code className="bg-muted px-1 rounded">{'{{nome}}'}</code>, <code className="bg-muted px-1 rounded">{'{{empresa}}'}</code>, <code className="bg-muted px-1 rounded">{'{{cidade}}'}</code>
                        </p>
                        <Textarea
                            placeholder="Bom dia {{nome}}! Estamos com uma promoção especial de Kit Bronze..."
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            rows={5}
                            className="mt-1.5 resize-none"
                        />
                    </div>

                    <div>
                        <Label>Banner / Foto (opcional)</Label>
                        <div className="mt-1.5">
                            {mediaPreview ? (
                                <div className="relative rounded-xl overflow-hidden border border-border">
                                    <img src={mediaPreview} alt="preview" className="w-full max-h-48 object-cover" />
                                    <button
                                        onClick={() => { setMediaFile(null); setMediaPreview(null) }}
                                        className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                                    >
                                        <XCircle className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                                    <ImageIcon className="w-8 h-8 text-muted-foreground mb-2" />
                                    <span className="text-sm text-muted-foreground">Clique para enviar imagem</span>
                                    <span className="text-xs text-muted-foreground/60 mt-1">JPG, PNG, WEBP até 10MB</span>
                                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                                </label>
                            )}
                        </div>
                    </div>

                    <div>
                        <Label>Filtrar por cidades (opcional)</Label>
                        <Input
                            placeholder="Ex: Salvador, Feira de Santana, Vitória da Conquista"
                            value={cities}
                            onChange={e => setCities(e.target.value)}
                            className="mt-1.5"
                        />
                        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {contactCount !== null ? (
                                <span><strong className="text-foreground">{contactCount}</strong> contatos serão alcançados</span>
                            ) : 'Calculando...'}
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={loading || !name || !message}>
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                        Criar Campanha
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CampanhasPage() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([])
    const [loading, setLoading] = useState(true)
    const [showNew, setShowNew] = useState(false)
    const [filter, setFilter] = useState<string>('all')

    const loadCampaigns = async () => {
        setLoading(true)
        const supabase = createClient()
        const { data } = await supabase
            .from('campaigns')
            .select('*')
            .eq('org_id', ORG_ID)
            .order('created_at', { ascending: false })

        if (data) setCampaigns(data)
        setLoading(false)
    }

    useEffect(() => { loadCampaigns() }, [])

    const filtered = filter === 'all' ? campaigns : campaigns.filter(c => c.status === filter)

    const stats = {
        total: campaigns.length,
        sent: campaigns.filter(c => c.status === 'sent').length,
        totalReach: campaigns.reduce((a, c) => a + (c.sent_count || 0), 0),
        draft: campaigns.filter(c => c.status === 'draft').length,
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Megaphone className="w-6 h-6 text-primary" />
                        Campanhas
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Disparos em massa personalizados via WhatsApp
                    </p>
                </div>
                <Button onClick={() => setShowNew(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Campanha
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total', value: stats.total, icon: Megaphone, color: 'text-primary' },
                    { label: 'Enviadas', value: stats.sent, icon: CheckCircle2, color: 'text-emerald-500' },
                    { label: 'Mensagens', value: stats.totalReach.toLocaleString('pt-BR'), icon: Send, color: 'text-blue-500' },
                    { label: 'Rascunhos', value: stats.draft, icon: FileImage, color: 'text-zinc-400' },
                ].map(s => (
                    <div key={s.label} className="bg-card border border-border rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <s.icon className={`w-4 h-4 ${s.color}`} />
                            <span className="text-xs text-muted-foreground">{s.label}</span>
                        </div>
                        <p className="text-2xl font-bold text-foreground">{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Filter */}
            <div className="flex gap-2 flex-wrap">
                {[
                    { value: 'all', label: 'Todas' },
                    { value: 'draft', label: 'Rascunhos' },
                    { value: 'scheduled', label: 'Agendadas' },
                    { value: 'sending', label: 'Enviando' },
                    { value: 'sent', label: 'Enviadas' },
                ].map(f => (
                    <button
                        key={f.value}
                        onClick={() => setFilter(f.value)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f.value
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="border border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-center p-16 bg-card/50">
                    <Megaphone className="w-12 h-12 text-muted-foreground/30 mb-4" />
                    <h2 className="text-lg font-semibold text-foreground">Nenhuma campanha ainda</h2>
                    <p className="text-muted-foreground text-sm mt-2 max-w-sm">
                        Crie sua primeira campanha para disparar mensagens personalizadas com banner via WhatsApp.
                    </p>
                    <Button className="mt-6" onClick={() => setShowNew(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Criar primeira campanha
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(c => (
                        <CampaignCard key={c.id} campaign={c} onSelect={() => { }} />
                    ))}
                </div>
            )}

            <NewCampaignDialog
                open={showNew}
                onClose={() => setShowNew(false)}
                onCreated={loadCampaigns}
            />
        </div>
    )
}