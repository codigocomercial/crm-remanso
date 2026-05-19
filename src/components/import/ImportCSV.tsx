'use client'

import React, { useCallback, useRef, useState } from 'react'
import {
  Upload, FileText, CheckCircle2, XCircle, Loader2,
  AlertCircle, Building2, ChevronDown, ChevronUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
interface ImportResult {
  success: boolean
  inserted: number
  updated: number
  errors: string[]
}

interface PreviewRow {
  bling_id: string
  corporate_name: string
  fantasy_name: string
  cnpj: string
  city: string
  state: string
  phone: string
  email: string
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  const sep = lines[0].includes(';') ? ';' : ','

  function parseLine(line: string): string[] {
    const fields: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === sep && !inQuotes) {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    fields.push(current.trim())
    return fields
  }

  const headers = parseLine(lines[0]).map(h => h.replace(/^\uFEFF/, '').trim())

  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i])
    if (values.length < 2) continue
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = values[idx] ?? '' })
    rows.push(row)
  }
  return rows
}

function cleanCNPJ(val: string): string {
  return val.replace(/\D/g, '')
}

function cleanDate(val: string): string | null {
  if (!val) return null
  const parts = val.split('/')
  if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
  return null
}

function filterClientes(rows: Record<string, string>[]): Record<string, string>[] {
  return rows.filter(r => {
    const tipo = r['Tipo contato'] ?? ''
    return tipo.includes('Cliente')
  })
}

function toPreview(row: Record<string, string>): PreviewRow {
  return {
    bling_id: row['ID'] ?? '',
    corporate_name: row['Nome'] ?? '',
    fantasy_name: row['Fantasia'] ?? '',
    cnpj: cleanCNPJ(row['CNPJ / CPF'] ?? ''),
    city: row['Cidade'] ?? '',
    state: row['UF'] ?? '',
    phone: row['Fone'] || row['Celular'] || '',
    email: row['E-mail'] ?? '',
  }
}

// ─── API call ─────────────────────────────────────────────────────────────────
async function importCompanies(rows: Record<string, string>[]): Promise<ImportResult> {
  const clientes = filterClientes(rows)

  const payload = clientes.map(row => ({
    bling_id: parseInt(row['ID'] ?? '0'),
    corporate_name: row['Nome'] ?? '',
    fantasy_name: row['Fantasia'] || null,
    cnpj: cleanCNPJ(row['CNPJ / CPF'] ?? '') || null,
    state_registration: row['IE / RG'] || null,
    city: row['Cidade'] || null,
    state: row['UF'] || null,
    address: row['Endereço'] || null,
    number: row['Número'] || null,
    neighborhood: row['Bairro'] || null,
    zip_code: row['CEP'] || null,
    phone: row['Fone'] || row['Celular'] || null,
    whatsapp: row['Celular'] || null,
    email: row['E-mail'] || null,
    is_active: row['Situação'] === 'Ativo',
    client_since: cleanDate(row['Cliente desde'] ?? ''),
  }))

  const res = await fetch('/api/import/companies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companies: payload }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { success: false, inserted: 0, updated: 0, errors: [err.error ?? 'Erro desconhecido'] }
  }

  return res.json()
}

// ─── Drop Zone ────────────────────────────────────────────────────────────────
function DropZone({ onFile }: { onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file?.name.endsWith('.csv')) onFile(file)
  }, [onFile])

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200',
        dragging
          ? 'border-primary bg-primary/5 scale-[1.01]'
          : 'border-border hover:border-primary/50 hover:bg-muted/30'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
      <Upload className={cn('w-8 h-8 mx-auto mb-3 transition-colors', dragging ? 'text-primary' : 'text-muted-foreground/40')} />
      <p className="text-sm font-medium text-foreground">
        {dragging ? 'Solte o arquivo aqui' : 'Arraste o CSV de Contatos do Bling'}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        ou clique para selecionar • apenas arquivos .csv
      </p>
    </div>
  )
}

// ─── Preview Table ────────────────────────────────────────────────────────────
function PreviewTable({ rows, total }: { rows: PreviewRow[]; total: number }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? rows : rows.slice(0, 5)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{total}</span> clientes encontrados no CSV
        </p>
        <span className="text-xs text-muted-foreground">Prévia das primeiras {Math.min(5, total)} linhas</span>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nome</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Fantasia</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">CNPJ</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Cidade/UF</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Telefone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((row, i) => (
                <tr key={i} className="bg-card hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2 font-medium text-foreground truncate max-w-[180px]">{row.corporate_name || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground truncate max-w-[140px]">{row.fantasy_name || '—'}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{row.cnpj || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{[row.city, row.state].filter(Boolean).join('/') || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.phone || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > 5 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 border-t border-border transition-colors"
          >
            {expanded ? <><ChevronUp className="w-3.5 h-3.5" />Mostrar menos</> : <><ChevronDown className="w-3.5 h-3.5" />Ver mais {total - 5} linhas</>}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function SectionImportCSV() {
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [step, setStep] = useState<'idle' | 'preview' | 'importing' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleFile(f: File) {
    setFile(f)
    setStep('idle')
    setResult(null)
    setError(null)

    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      const clientes = filterClientes(parsed)
      setRows(parsed)
      setPreview(clientes.map(toPreview))
      setStep('preview')
    }
    reader.readAsText(f, 'UTF-8')
  }

  async function handleImport() {
    setStep('importing')
    setError(null)
    try {
      const res = await importCompanies(rows)
      setResult(res)
      setStep(res.success ? 'done' : 'error')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
      setStep('error')
    }
  }

  function handleReset() {
    setFile(null)
    setRows([])
    setPreview([])
    setStep('idle')
    setResult(null)
    setError(null)
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-4 h-4 text-orange-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Importar Empresas via CSV</h2>
          <p className="text-xs text-muted-foreground">
            Exporte o CSV de Contatos do Bling e importe aqui para atualizar as empresas do CRM
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-50 border border-orange-200 text-orange-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-orange-500" />
          <p className="text-xs leading-relaxed">
            No Bling vá em <strong>Contatos → Exportar</strong> e baixe o CSV completo.
            Só serão importados contatos com <strong>Tipo contato = Cliente</strong>.
          </p>
        </div>

        {step === 'idle' && (
          <DropZone onFile={handleFile} />
        )}

        {(step === 'preview' || step === 'importing') && file && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border border-border">
              <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button onClick={handleReset} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Trocar
              </button>
            </div>

            {preview.length > 0 ? (
              <PreviewTable rows={preview} total={preview.length} />
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p className="text-xs">Nenhum cliente encontrado no CSV. Verifique se o arquivo é de Contatos do Bling.</p>
              </div>
            )}

            {preview.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <Button onClick={handleImport} disabled={step === 'importing'} className="flex-1 sm:flex-none">
                  {step === 'importing'
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importando...</>
                    : `Importar ${preview.length} clientes`
                  }
                </Button>
                <Button variant="outline" onClick={handleReset} disabled={step === 'importing'}>
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        )}

        {step === 'done' && result && (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">Importação concluída!</p>
                <p className="text-xs text-emerald-700 mt-1">
                  <span className="font-medium">{result.inserted}</span> novas empresas inseridas •{' '}
                  <span className="font-medium">{result.updated}</span> atualizadas
                </p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-xs font-semibold text-amber-800 mb-1">Avisos ({result.errors.length}):</p>
                <ul className="space-y-0.5">
                  {result.errors.slice(0, 5).map((e, i) => (
                    <li key={i} className="text-xs text-amber-700 font-mono">{e}</li>
                  ))}
                  {result.errors.length > 5 && (
                    <li className="text-xs text-amber-600">... e mais {result.errors.length - 5} avisos</li>
                  )}
                </ul>
              </div>
            )}
            <Button variant="outline" onClick={handleReset} className="w-full sm:w-auto">
              Importar outro arquivo
            </Button>
          </div>
        )}

        {step === 'error' && (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">Falha na importação</p>
                <p className="text-xs text-red-700 mt-1">{error ?? result?.errors[0] ?? 'Erro desconhecido'}</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleReset}>Tentar novamente</Button>
          </div>
        )}
      </div>
    </section>
  )
}