'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Building2, Search, Plus, MapPin, Users, Loader2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import Link from 'next/link'

interface Company {
  id: string
  name: string
  segment: string | null
  city: string | null
  contactsCount: number
}

export default function EmpresasPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    async function loadCompanies() {
      setLoading(true)
      const supabase = createClient()
      
      let query = supabase
        .from('companies')
        .select(`
          id, name, segment, city,
          contacts ( id )
        `)
        .order('name', { ascending: true })

      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`)
      }

      const { data, error } = await query

      if (!error && data) {
        const formatted = data.map((d: any) => ({
          id: d.id,
          name: d.name,
          segment: d.segment,
          city: d.city,
          contactsCount: d.contacts?.length || 0
        }))
        setCompanies(formatted)
      }
      setLoading(false)
    }

    const timeout = setTimeout(loadCompanies, 300)
    return () => clearTimeout(timeout)
  }, [searchTerm])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Empresas
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gerenciamento de clientes PJ e parceiros</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Nova empresa
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar empresas..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="animate-pulse shadow-sm">
              <CardHeader className="h-16 bg-muted/20 pb-0" />
              <CardContent className="h-24 bg-muted/10 mt-2" />
            </Card>
          ))}
        </div>
      ) : companies.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-primary/60" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Ainda não há empresas</h2>
          <p className="text-muted-foreground mt-2 max-w-sm mb-4">
            {searchTerm ? 'Sua busca não encontrou nenhum registro.' : 'Cadastre sua primeira empresa para facilitar a organização dos seus clientes.'}
          </p>
          <Button variant="outline">
            Limpar Filtros
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map(company => (
            <Card key={company.id} className="hover:shadow-md transition-shadow group flex flex-col border-border/80">
              <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-start justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  <h3 className="font-semibold text-lg text-foreground truncate" title={company.name}>
                    {company.name}
                  </h3>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                    <span className="inline-flex py-0.5 px-2 bg-muted rounded-md font-medium text-xs">
                      {company.segment || 'Geral'}
                    </span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center flex-shrink-0 text-primary">
                  <Building2 className="w-5 h-5" />
                </div>
              </CardHeader>
              <CardContent className="pt-4 pb-5 flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 flex-shrink-0 text-muted-foreground/70" />
                    <span className="truncate">{company.city || 'Localidade não informada'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Users className="w-4 h-4 flex-shrink-0 text-muted-foreground/70" />
                    <span>
                      {company.contactsCount} {company.contactsCount === 1 ? 'contato vinculado' : 'contatos vinculados'}
                    </span>
                  </div>
                </div>
                <Button variant="ghost" className="w-full mt-5 group-hover:bg-primary/5 group-hover:text-primary transition-colors">
                  <Link href={`/empresas/${company.id}`}>
                    Ver detalhes abordados <ArrowRight className="w-4 h-4 ml-2 opacity-60" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
