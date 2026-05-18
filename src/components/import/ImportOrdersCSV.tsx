'use client'

import React, { useCallback, useRef, useState } from 'react'
import { Upload, FileText, CheckCircle2, XCircle, Loader2, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ImportResult {
  success: boolean
  total_pedidos: number
  created: number
  updated: number
  errors: number
  error_details?: string[]
}

function DropZone({ onFile }: { onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }, [onFile])

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
        dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.txt"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
      <Upload className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
      <p className="text-sm font-medium text-foreground">Arraste o CSV ou clique para selecionar</p>
      <p className="text-xs text-muted-foreground mt-1">Exportado do Bling → Pedidos de Venda</p>
    </div>
  )
}

export function SectionImportOrdersCSV() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const text = await file.text()
      const res = await fetch('/api/import/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: text }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro ao importar')
      } else {
        setResult(data)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
          <ShoppingCart className="w-4 h-4 text-orange-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Importar Pedidos via CSV</h2>
          <p className="text-xs text-muted-foreground">
            Exporte os pedidos do Bling em CSV e importe aqui. Calcula urnas, custo MP e margem automaticamente.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
            <p className="text-sm text-muted-foreground">Processando pedidos...</p>
          </div>
        ) : (
          <DropZone onFile={handleFile} />
        )}

        {result && (
          <div className={cn(
            'flex items-start gap-3 p-4 rounded-xl border text-sm',
            result.errors === 0
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          )}>
            {result.errors === 0
              ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              : <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            }
            <div>
              <p className="font-medium">
                {result.total_pedidos} pedidos processados — {result.created} criados, {result.updated} atualizados
                {result.errors > 0 && `, ${result.errors} erros`}
              </p>
              {result.error_details && result.error_details.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {result.error_details.map((e, i) => (
                    <li key={i} className="text-xs font-mono">{e}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            <XCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1 pt-1">
          <p className="font-medium text-foreground">Como exportar do Bling:</p>
          <p>1. Bling → Vendas → Pedidos de Venda</p>
          <p>2. Filtrar pelo período desejado</p>
          <p>3. Exportar → CSV</p>
        </div>
      </div>
    </section>
  )
}
