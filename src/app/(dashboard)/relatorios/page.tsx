'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart as BarChartIcon, Users, MessageCircle, AlertTriangle, DollarSign, Loader2, Trophy, ArrowRight, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

interface Metrics {
  totalContacts: number
  totalInteractions: number
  lateFollowups: number
  averageTicket: number
}

interface ChartDataPoint {
  date: string
  count: number
}

interface TopClient {
  id: string
  full_name: string
  average_order_value: number
}

export default function RelatoriosPage() {
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<Metrics>({
    totalContacts: 0,
    totalInteractions: 0,
    lateFollowups: 0,
    averageTicket: 0,
  })
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [topClients, setTopClients] = useState<TopClient[]>([])

  useEffect(() => {
    async function fetchDashboard() {
      setLoading(true)
      const supabase = createClient()
      const todayIso = new Date().toISOString()
      
      // Datas para gráfico
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const thirtyDaysAgoIso = thirtyDaysAgo.toISOString()

      // Paraleliza as requisições principais de contagem
      const [
        resContacts, 
        resInteractions, 
        resLate, 
        resAOV, 
        resChart, 
        resTop5
      ] = await Promise.all([
        supabase.from('contacts').select('*', { count: 'exact', head: true }),
        supabase.from('interactions').select('*', { count: 'exact', head: true }),
        supabase.from('contacts').select('*', { count: 'exact', head: true }).lte('next_followup_at', todayIso),
        supabase.from('contacts').select('average_order_value').not('average_order_value', 'is', null),
        supabase.from('interactions').select('created_at').gte('created_at', thirtyDaysAgoIso),
        supabase.from('contacts').select('id, full_name, average_order_value').not('average_order_value', 'is', null).order('average_order_value', { ascending: false }).limit(5)
      ])

      // Cálculo do AVG Ticket Client Client-side pois o sumário exact SQL demanda config extra
      let avg = 0
      if (resAOV.data && resAOV.data.length > 0) {
        const sum = resAOV.data.reduce((acc, curr) => acc + (curr.average_order_value || 0), 0)
        avg = sum / resAOV.data.length
      }

      setMetrics({
        totalContacts: resContacts.count ?? 0,
        totalInteractions: resInteractions.count ?? 0,
        lateFollowups: resLate.count ?? 0,
        averageTicket: avg
      })

      if (resTop5.data) {
        setTopClients(resTop5.data as TopClient[])
      }

      // Preparar Array de 30 dias contínuos independentemente se teve dados para plotar 0 corretamente
      if (resChart.data) {
        const agregation: Record<string, number> = {}
        for (let i = 29; i >= 0; i--) {
           const d = new Date()
           d.setDate(d.getDate() - i)
           const key = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}`
           agregation[key] = 0
        }

        resChart.data.forEach(item => {
           const d = new Date(item.created_at)
           const key = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}`
           if(agregation[key] !== undefined) {
              agregation[key]++
           }
        })
        
        const chartArr = Object.keys(agregation).map(k => ({
          date: k,
          count: agregation[k]
        }))
        setChartData(chartArr)
      }

      setLoading(false)
    }

    fetchDashboard()
  }, [])

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <BarChartIcon className="w-7 h-7 text-primary" />
          Métricas e Relatórios
        </h1>
        <p className="text-base text-muted-foreground mt-1">
          Visão geral do desempenho de vendas e produtividade do time.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 opacity-50">
           <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
           <p className="text-sm font-medium">Processando inteligência de dados...</p>
        </div>
      ) : (
        <>
          {/* Main KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <Card className="border-border shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Carteira Ativa</p>
                    <p className="text-3xl font-bold text-foreground mt-2">{metrics.totalContacts}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-700">
                     <Users className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Total Interações</p>
                    <p className="text-3xl font-bold text-foreground mt-2">{metrics.totalInteractions}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-700">
                     <MessageCircle className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm ring-1 ring-red-500/20 bg-red-50/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-red-500/80 uppercase tracking-wide">Recompras Atrasadas</p>
                    <p className="text-3xl font-bold text-red-600 mt-2">{metrics.lateFollowups}</p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                     <AlertTriangle className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Ticket M. Geral</p>
                    <p className="text-3xl font-bold text-emerald-600 mt-2">{formatCurrency(metrics.averageTicket)}</p>
                  </div>
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                     <DollarSign className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Chart */}
            <Card className="lg:col-span-2 border-border shadow-sm">
              <CardHeader className="border-b border-border/50 pb-5">
                <CardTitle className="flex items-center gap-2 text-xl">
                   <TrendingUp className="w-5 h-5 text-primary" />
                   Volume de Interações
                </CardTitle>
                <CardDescription>
                  Histórico diário de prospecções, ligações e fowllow-ups dos últimos 30 dias.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pb-2">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                        axisLine={false} 
                        tickLine={false} 
                        tickMargin={10}
                      />
                      <YAxis 
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                        axisLine={false} 
                        tickLine={false} 
                        allowDecimals={false}
                      />
                      <Tooltip 
                        cursor={{ fill: 'hsl(var(--muted)/0.4)' }}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          color: 'hsl(var(--foreground))',
                          fontSize: '13px',
                          fontWeight: 500,
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
                        }}
                        formatter={(value: any) => [`${value} Ações`, 'Registro']}
                        labelFormatter={(label) => `Dia ${label}`}
                      />
                      <Bar 
                        dataKey="count" 
                        fill="hsl(var(--primary))" 
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Top 5 Clients List */}
            <Card className="border-border shadow-sm flex flex-col">
              <CardHeader className="border-b border-border/50 pb-5">
                <CardTitle className="flex items-center gap-2 text-xl">
                   <Trophy className="w-5 h-5 text-amber-500" />
                   Top 5 Parceiros
                </CardTitle>
                <CardDescription>
                   Líderes ranqueados pelo histórico do maior ticket médio de negócio.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 flex-1 flex flex-col">
                <div className="flex-1 overflow-y-auto">
                  {topClients.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground py-10">
                      Nenhum ranking disponível.
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {topClients.map((client, index) => (
                        <li key={client.id} className="p-4 hover:bg-muted/30 transition-colors flex items-center justify-between group">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${index === 0 ? 'bg-amber-100 text-amber-600' : index === 1 ? 'bg-slate-200 text-slate-700' : index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground'}`}>
                               {index + 1}º
                            </div>
                            <div className="min-w-0 pr-4">
                              <p className="font-semibold text-sm text-foreground truncate">{client.full_name}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                 <DollarSign className="w-3 h-3" />
                                 {formatCurrency(client.average_order_value)}
                              </p>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link href={`/clientes/${client.id}`}>
                              <ArrowRight className="w-4 h-4 text-muted-foreground"/>
                            </Link>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="p-4 border-t border-border mt-auto bg-muted/20">
                   <Button variant="outline" className="w-full text-xs h-9">
                     <Link href="/clientes">Ver todos os clientes</Link>
                   </Button>
                </div>
              </CardContent>
            </Card>

          </div>
        </>
      )}
    </div>
  )
}
