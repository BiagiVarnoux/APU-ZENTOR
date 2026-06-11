'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Recurso, Categoria, RendimientoEscenario } from '@/lib/types'
import Modal from '@/components/modal'

const CATEGORIAS_FIJAS = ['Todos', 'Material', 'Mano de Obra', 'Equipo']

type FormData = {
  nombre: string
  unidad: string
  precio: string
  categoria_id: string
  rendimiento_default: string
  rendimiento_descripcion: string
  notas: string
}

const emptyForm: FormData = {
  nombre: '',
  unidad: '',
  precio: '',
  categoria_id: '',
  rendimiento_default: '',
  rendimiento_descripcion: '',
  notas: '',
}

export default function CatalogoPage() {
  const [recursos, setRecursos] = useState<Recurso[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [filtro, setFiltro] = useState('Todos')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Recurso | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [deleting, setDeleting] = useState<Recurso | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [escenarios, setEscenarios] = useState<RendimientoEscenario[]>([])
  const [newEscenario, setNewEscenario] = useState({ nombre: '', rendimiento: '', descripcion: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const { data: cats } = await supabase.from('categorias').select('*').order('nombre')
    const { data: recs } = await supabase
      .from('recursos')
      .select('*, categoria:categorias(id,nombre), rendimiento_escenarios(*)')
      .eq('activo', true)
      .order('nombre')
    setCategorias(cats || [])
    setRecursos(recs || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = filtro === 'Todos'
    ? recursos
    : recursos.filter(r => r.categoria?.nombre === filtro)

  function openAdd() {
    setEditing(null)
    setForm(emptyForm)
    setEscenarios([])
    setError('')
    setShowForm(true)
  }

  function openEdit(r: Recurso) {
    setEditing(r)
    setForm({
      nombre: r.nombre,
      unidad: r.unidad,
      precio: String(r.precio),
      categoria_id: r.categoria_id || '',
      rendimiento_default: r.rendimiento_default != null ? String(r.rendimiento_default) : '',
      rendimiento_descripcion: r.rendimiento_descripcion || '',
      notas: r.notas || '',
    })
    setEscenarios(r.rendimiento_escenarios || [])
    setError('')
    setShowForm(true)
  }

  async function save() {
    if (!form.nombre.trim() || !form.unidad.trim() || !form.precio) {
      setError('Nombre, unidad y precio son obligatorios.')
      return
    }
    setSaving(true)
    const payload = {
      nombre: form.nombre.trim(),
      unidad: form.unidad.trim(),
      precio: parseFloat(form.precio),
      categoria_id: form.categoria_id || null,
      rendimiento_default: form.rendimiento_default ? parseFloat(form.rendimiento_default) : null,
      rendimiento_descripcion: form.rendimiento_descripcion.trim() || null,
      notas: form.notas.trim() || null,
    }
    let recursoId = editing?.id
    if (editing) {
      await supabase.from('recursos').update(payload).eq('id', editing.id)
    } else {
      const { data } = await supabase.from('recursos').insert(payload).select().single()
      recursoId = data?.id
    }
    if (recursoId) {
      await supabase.from('rendimiento_escenarios').delete().eq('recurso_id', recursoId)
      const toInsert = escenarios
        .filter(e => e.nombre && e.rendimiento)
        .map(e => ({ recurso_id: recursoId!, nombre: e.nombre, rendimiento: e.rendimiento, descripcion: e.descripcion }))
      if (toInsert.length) await supabase.from('rendimiento_escenarios').insert(toInsert)
    }
    setSaving(false)
    setShowForm(false)
    load()
  }

  async function confirmDelete() {
    if (!deleting) return
    await supabase.from('recursos').update({ activo: false }).eq('id', deleting.id)
    setDeleting(null)
    load()
  }

  function addEscenario() {
    if (!newEscenario.nombre || !newEscenario.rendimiento) return
    setEscenarios(prev => [...prev, {
      id: crypto.randomUUID(),
      recurso_id: editing?.id || '',
      nombre: newEscenario.nombre,
      rendimiento: parseFloat(newEscenario.rendimiento),
      descripcion: newEscenario.descripcion || null,
    }])
    setNewEscenario({ nombre: '', rendimiento: '', descripcion: '' })
  }

  function removeEscenario(id: string) {
    setEscenarios(prev => prev.filter(e => e.id !== id))
  }

  const fmt = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Catálogo de Recursos</h1>
          <p className="mt-1 text-sm text-slate-500">Materiales, mano de obra y equipos con precios actualizables</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <Plus className="h-4 w-4" /> Agregar Recurso
        </button>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex gap-2">
        {CATEGORIAS_FIJAS.map(cat => (
          <button
            key={cat}
            onClick={() => setFiltro(cat)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filtro === cat
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {cat}
            {cat !== 'Todos' && (
              <span className="ml-1.5 text-xs opacity-70">
                ({recursos.filter(r => r.categoria?.nombre === cat).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-400">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            No hay recursos. Agrega el primero con el botón de arriba.
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Nombre</th>
                <th className="th">Categoría</th>
                <th className="th">Unidad</th>
                <th className="th text-right">Precio</th>
                <th className="th">Rendimiento</th>
                <th className="th w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(r => (
                <>
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="td font-medium text-slate-900">
                      <button
                        onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                        className="flex items-center gap-1 text-left hover:text-blue-600"
                      >
                        {r.rendimiento_escenarios && r.rendimiento_escenarios.length > 0 && (
                          expandedId === r.id
                            ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                            : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                        )}
                        {r.nombre}
                      </button>
                      {r.notas && <p className="text-xs text-slate-400 mt-0.5">{r.notas}</p>}
                    </td>
                    <td className="td">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        {r.categoria?.nombre || '—'}
                      </span>
                    </td>
                    <td className="td text-slate-500">{r.unidad}</td>
                    <td className="td text-right font-semibold text-slate-900">${fmt(r.precio)}</td>
                    <td className="td text-slate-500 text-sm">
                      {r.rendimiento_default != null
                        ? <span>{r.rendimiento_default} <span className="text-slate-400">{r.rendimiento_descripcion || ''}</span></span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="td">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(r)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition-colors">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setDeleting(r)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === r.id && r.rendimiento_escenarios && r.rendimiento_escenarios.length > 0 && (
                    <tr key={`${r.id}-esc`} className="bg-blue-50/50">
                      <td colSpan={6} className="px-8 py-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-600">Escenarios de rendimiento</p>
                        <div className="flex flex-wrap gap-2">
                          {r.rendimiento_escenarios.map(e => (
                            <span key={e.id} className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-slate-700">
                              <span className="font-semibold">{e.nombre}:</span> {e.rendimiento} {r.rendimiento_descripcion || ''}
                              {e.descripcion && <span className="text-slate-400"> — {e.descripcion}</span>}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal formulario */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Editar Recurso' : 'Nuevo Recurso'} size="lg">
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {error}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Nombre *</label>
            <input className="input" placeholder="Ej: Cemento Portland" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          </div>
          <div>
            <label className="label">Categoría</label>
            <select className="input" value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}>
              <option value="">Sin categoría</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Unidad *</label>
            <input className="input" placeholder="Ej: kg, m², jornal, hr" value={form.unidad} onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))} />
          </div>
          <div>
            <label className="label">Precio unitario *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input className="input pl-7" type="number" step="0.01" min="0" placeholder="0.00" value={form.precio} onChange={e => setForm(f => ({ ...f, precio: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Rendimiento promedio</label>
            <input className="input" type="number" step="0.0001" min="0" placeholder="Ej: 10" value={form.rendimiento_default} onChange={e => setForm(f => ({ ...f, rendimiento_default: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="label">Unidad del rendimiento</label>
            <input className="input" placeholder='Ej: m²/m  o  m²/gal  o  m²/jornal' value={form.rendimiento_descripcion} onChange={e => setForm(f => ({ ...f, rendimiento_descripcion: e.target.value }))} />
            <p className="mt-1 text-xs text-slate-400">Describe qué cubre el rendimiento. Ej: "10 m²/m" significa que 1 metro de lija cubre 10 m² de muro.</p>
          </div>
          <div className="col-span-2">
            <label className="label">Notas</label>
            <input className="input" placeholder="Observaciones opcionales" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
          </div>
        </div>

        {/* Escenarios de rendimiento */}
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Escenarios de rendimiento alternativos</h3>
          <p className="mb-3 text-xs text-slate-400">Agrega variaciones del rendimiento según el tipo de superficie o condición de uso.</p>

          {escenarios.length > 0 && (
            <div className="mb-3 rounded-lg border border-slate-200 divide-y">
              {escenarios.map(e => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="font-medium text-sm text-slate-700 w-32 truncate">{e.nombre}</span>
                  <span className="text-sm text-blue-600 font-semibold">{e.rendimiento}</span>
                  <span className="text-xs text-slate-400 flex-1">{e.descripcion || ''}</span>
                  <button onClick={() => removeEscenario(e.id)} className="text-slate-300 hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              className="input flex-1" placeholder="Nombre (Ej: Muro rugoso)"
              value={newEscenario.nombre} onChange={e => setNewEscenario(n => ({ ...n, nombre: e.target.value }))}
            />
            <input
              className="input w-28" type="number" step="0.01" placeholder="Rendim."
              value={newEscenario.rendimiento} onChange={e => setNewEscenario(n => ({ ...n, rendimiento: e.target.value }))}
            />
            <input
              className="input flex-1" placeholder="Descripción (opcional)"
              value={newEscenario.descripcion} onChange={e => setNewEscenario(n => ({ ...n, descripcion: e.target.value }))}
            />
            <button onClick={addEscenario} className="btn-secondary px-3">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear recurso'}
          </button>
        </div>
      </Modal>

      {/* Modal eliminar */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Eliminar Recurso" size="sm">
        <p className="text-sm text-slate-600">
          ¿Seguro que quieres eliminar <strong>{deleting?.nombre}</strong>?
          Los APUs que lo usen conservarán sus datos históricos.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => setDeleting(null)} className="btn-secondary">Cancelar</button>
          <button onClick={confirmDelete} className="btn-danger">Eliminar</button>
        </div>
      </Modal>
    </div>
  )
}
