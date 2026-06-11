'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { Plus, FolderOpen, Lock, Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Proyecto } from '@/lib/types'
import Modal from '@/components/modal'

const fmt = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type ProyectoForm = {
  nombre: string
  cliente: string
  descripcion: string
  factor_indirecto: string
  factor_utilidad: string
}
const emptyForm: ProyectoForm = {
  nombre: '', cliente: '', descripcion: '', factor_indirecto: '0', factor_utilidad: '0'
}

export default function ProyectosPage() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<ProyectoForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('proyectos')
      .select('*, partidas(id)')
      .order('created_at', { ascending: false })
    setProyectos(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!form.nombre.trim()) { setError('El nombre del proyecto es obligatorio.'); return }
    setSaving(true)
    await supabase.from('proyectos').insert({
      nombre: form.nombre.trim(),
      cliente: form.cliente.trim() || null,
      descripcion: form.descripcion.trim() || null,
      factor_indirecto: parseFloat(form.factor_indirecto) || 0,
      factor_utilidad: parseFloat(form.factor_utilidad) || 0,
    })
    setSaving(false)
    setShowForm(false)
    setForm(emptyForm)
    load()
  }

  const estadoBadge = (estado: Proyecto['estado']) => {
    if (estado === 'borrador') return <span className="badge-borrador"><Clock className="h-3 w-3 mr-1" />Borrador</span>
    if (estado === 'bloqueado') return <span className="badge-bloqueado"><Lock className="h-3 w-3 mr-1" />Precios bloqueados</span>
    return <span className="badge-completado"><CheckCircle className="h-3 w-3 mr-1" />Completado</span>
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Proyectos</h1>
          <p className="mt-1 text-sm text-slate-500">Presupuestos por proyecto con precios independientes</p>
        </div>
        <button onClick={() => { setForm(emptyForm); setError(''); setShowForm(true) }} className="btn-primary">
          <Plus className="h-4 w-4" /> Nuevo Proyecto
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400">Cargando...</div>
      ) : proyectos.length === 0 ? (
        <div className="py-20 text-center">
          <FolderOpen className="h-12 w-12 mx-auto text-slate-200 mb-3" />
          <p className="text-sm text-slate-400">Sin proyectos todavía. Crea el primero.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {proyectos.map(p => (
            <Link key={p.id} href={`/proyectos/${p.id}`} className="card p-5 hover:shadow-md hover:border-blue-200 transition-all block group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">{p.nombre}</p>
                  {p.cliente && <p className="text-xs text-slate-400 mt-0.5">{p.cliente}</p>}
                </div>
                {estadoBadge(p.estado)}
              </div>
              {p.descripcion && <p className="text-sm text-slate-500 mb-3 line-clamp-2">{p.descripcion}</p>}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-3">
                <span className="text-xs text-slate-400">
                  {(p.partidas as any)?.length || 0} partidas
                </span>
                <div className="flex gap-3 text-xs text-slate-400">
                  {p.factor_indirecto > 0 && <span>Indirecto: {p.factor_indirecto}%</span>}
                  {p.factor_utilidad > 0 && <span>Utilidad: {p.factor_utilidad}%</span>}
                </div>
              </div>
              <p className="text-xs text-slate-300 mt-2">
                {new Date(p.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
            </Link>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nuevo Proyecto" size="md">
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {error}
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="label">Nombre del proyecto *</label>
            <input className="input" placeholder="Ej: Remodelación Oficinas Norte" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          </div>
          <div>
            <label className="label">Cliente</label>
            <input className="input" placeholder="Nombre del cliente" value={form.cliente} onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))} />
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input resize-none h-20" placeholder="Descripción del alcance (opcional)" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Costos indirectos (%)</label>
              <input className="input" type="number" min="0" max="100" step="0.5" placeholder="0" value={form.factor_indirecto} onChange={e => setForm(f => ({ ...f, factor_indirecto: e.target.value }))} />
              <p className="mt-1 text-xs text-slate-400">Administración, gastos generales</p>
            </div>
            <div>
              <label className="label">Utilidad (%)</label>
              <input className="input" type="number" min="0" max="100" step="0.5" placeholder="0" value={form.factor_utilidad} onChange={e => setForm(f => ({ ...f, factor_utilidad: e.target.value }))} />
              <p className="mt-1 text-xs text-slate-400">Margen de ganancia</p>
            </div>
          </div>
          <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            Puedes cambiar los porcentajes después. Los precios de los APUs se toman del catálogo hasta que decidas <strong>bloquear</strong> el presupuesto.
          </p>
        </div>
        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? 'Creando...' : 'Crear proyecto'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
