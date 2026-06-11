'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, AlertTriangle, Info } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { APU, APUItem, Recurso } from '@/lib/types'
import Modal from '@/components/modal'

const fmt = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function calcPrecioUnitario(items: APUItem[]): number {
  return items.reduce((sum, item) => {
    const precio = item.recurso?.precio || 0
    return sum + item.cantidad * precio
  }, 0)
}

type APUFormData = { nombre: string; unidad: string; descripcion: string }
const emptyAPUForm: APUFormData = { nombre: '', unidad: '', descripcion: '' }

export default function APUsPage() {
  const [apus, setApus] = useState<APU[]>([])
  const [recursos, setRecursos] = useState<Recurso[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<APU | null>(null)
  const [apuForm, setApuForm] = useState<APUFormData>(emptyAPUForm)
  const [items, setItems] = useState<APUItem[]>([])
  const [deleting, setDeleting] = useState<APU | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newItem, setNewItem] = useState({ recurso_id: '', cantidad: '', rendimiento: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const { data: apuData } = await supabase
      .from('apus')
      .select('*, apu_items(*, recurso:recursos(*, categoria:categorias(nombre)))')
      .order('nombre')
    const { data: recData } = await supabase
      .from('recursos')
      .select('*, categoria:categorias(nombre)')
      .eq('activo', true)
      .order('nombre')
    setApus(apuData || [])
    setRecursos(recData || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditing(null)
    setApuForm(emptyAPUForm)
    setItems([])
    setError('')
    setShowForm(true)
  }

  function openEdit(apu: APU) {
    setEditing(apu)
    setApuForm({ nombre: apu.nombre, unidad: apu.unidad, descripcion: apu.descripcion || '' })
    setItems(apu.apu_items || [])
    setError('')
    setShowForm(true)
  }

  function addItem() {
    if (!newItem.recurso_id || !newItem.cantidad) return
    const recurso = recursos.find(r => r.id === newItem.recurso_id)
    if (!recurso) return
    setItems(prev => [...prev, {
      id: crypto.randomUUID(),
      apu_id: editing?.id || '',
      recurso_id: newItem.recurso_id,
      recurso,
      cantidad: parseFloat(newItem.cantidad),
      rendimiento: newItem.rendimiento ? parseFloat(newItem.rendimiento) : null,
      orden: prev.length,
    }])
    setNewItem({ recurso_id: '', cantidad: '', rendimiento: '' })
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function handleRecursoSelect(id: string) {
    const r = recursos.find(rec => rec.id === id)
    setNewItem(n => ({
      ...n,
      recurso_id: id,
      rendimiento: r?.rendimiento_default != null ? String(r.rendimiento_default) : '',
    }))
  }

  async function save() {
    if (!apuForm.nombre.trim() || !apuForm.unidad.trim()) {
      setError('Nombre y unidad son obligatorios.')
      return
    }
    if (items.length === 0) {
      setError('Agrega al menos un recurso al APU.')
      return
    }
    setSaving(true)
    const payload = {
      nombre: apuForm.nombre.trim(),
      unidad: apuForm.unidad.trim(),
      descripcion: apuForm.descripcion.trim() || null,
    }
    let apuId = editing?.id
    if (editing) {
      await supabase.from('apus').update(payload).eq('id', editing.id)
      await supabase.from('apu_items').delete().eq('apu_id', editing.id)
    } else {
      const { data } = await supabase.from('apus').insert(payload).select().single()
      apuId = data?.id
    }
    if (apuId) {
      const toInsert = items.map((item, idx) => ({
        apu_id: apuId!,
        recurso_id: item.recurso_id,
        cantidad: item.cantidad,
        rendimiento: item.rendimiento,
        orden: idx,
      }))
      await supabase.from('apu_items').insert(toInsert)
    }
    setSaving(false)
    setShowForm(false)
    load()
  }

  async function confirmDelete() {
    if (!deleting) return
    await supabase.from('apus').delete().eq('id', deleting.id)
    setDeleting(null)
    load()
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Análisis de Precios Unitarios</h1>
          <p className="mt-1 text-sm text-slate-500">Define los APUs que usarás en tus presupuestos</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <Plus className="h-4 w-4" /> Nuevo APU
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400">Cargando...</div>
      ) : apus.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-400">
          Sin APUs todavía. Crea el primero con el botón de arriba.
        </div>
      ) : (
        <div className="space-y-3">
          {apus.map(apu => {
            const precio = calcPrecioUnitario(apu.apu_items || [])
            const isOpen = expanded === apu.id
            return (
              <div key={apu.id} className="card overflow-hidden">
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : apu.id)}
                >
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{apu.nombre}</p>
                    {apu.descripcion && <p className="text-xs text-slate-400 mt-0.5">{apu.descripcion}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Precio unitario</p>
                    <p className="font-bold text-lg text-blue-700">${fmt(precio)} <span className="text-sm font-normal text-slate-400">/ {apu.unidad}</span></p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">
                    {(apu.apu_items || []).length} recursos
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={e => { e.stopPropagation(); openEdit(apu) }} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={e => { e.stopPropagation(); setDeleting(apu) }} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50/50">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="th">Recurso</th>
                          <th className="th">Categoría</th>
                          <th className="th">Unidad</th>
                          <th className="th text-right">Cantidad</th>
                          <th className="th text-right">Rendim. ref.</th>
                          <th className="th text-right">Precio unit.</th>
                          <th className="th text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(apu.apu_items || []).sort((a,b) => a.orden - b.orden).map(item => (
                          <tr key={item.id} className="bg-white">
                            <td className="td font-medium">{item.recurso?.nombre || '—'}</td>
                            <td className="td">
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                                {item.recurso?.categoria?.nombre || '—'}
                              </span>
                            </td>
                            <td className="td text-slate-500">{item.recurso?.unidad}</td>
                            <td className="td text-right">{item.cantidad}</td>
                            <td className="td text-right text-slate-400 text-xs">
                              {item.rendimiento != null ? item.rendimiento : '—'}
                            </td>
                            <td className="td text-right text-slate-500">${fmt(item.recurso?.precio || 0)}</td>
                            <td className="td text-right font-semibold">${fmt(item.cantidad * (item.recurso?.precio || 0))}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-blue-200 bg-blue-50">
                          <td colSpan={6} className="px-4 py-3 text-sm font-semibold text-blue-700 text-right">
                            Precio unitario total ({apu.unidad}):
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-blue-700">${fmt(precio)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal formulario APU */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Editar APU' : 'Nuevo APU'} size="xl">
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {error}
          </div>
        )}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="col-span-2">
            <label className="label">Nombre del APU *</label>
            <input className="input" placeholder="Ej: Pintura vinílica en muros interiores" value={apuForm.nombre} onChange={e => setApuForm(f => ({ ...f, nombre: e.target.value }))} />
          </div>
          <div>
            <label className="label">Unidad de medida *</label>
            <input className="input" placeholder="Ej: m², m, pza" value={apuForm.unidad} onChange={e => setApuForm(f => ({ ...f, unidad: e.target.value }))} />
          </div>
          <div className="col-span-3">
            <label className="label">Descripción</label>
            <input className="input" placeholder="Descripción o especificación técnica (opcional)" value={apuForm.descripcion} onChange={e => setApuForm(f => ({ ...f, descripcion: e.target.value }))} />
          </div>
        </div>

        <div className="border-t border-slate-100 pt-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Recursos del APU</h3>
            {items.length > 0 && (
              <p className="text-sm font-semibold text-blue-700">
                Precio unitario: ${fmt(calcPrecioUnitario(items))} / {apuForm.unidad || 'unidad'}
              </p>
            )}
          </div>

          {items.length > 0 && (
            <div className="mb-4 rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="th">Recurso</th>
                    <th className="th text-right">Cantidad / unidad APU</th>
                    <th className="th text-right">Rend. ref.</th>
                    <th className="th text-right">Precio</th>
                    <th className="th text-right">Subtotal</th>
                    <th className="th w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map(item => (
                    <tr key={item.id}>
                      <td className="td font-medium">{item.recurso?.nombre}</td>
                      <td className="td text-right">{item.cantidad} {item.recurso?.unidad}</td>
                      <td className="td text-right text-slate-400 text-xs">{item.rendimiento ?? '—'}</td>
                      <td className="td text-right text-slate-500">${fmt(item.recurso?.precio || 0)}</td>
                      <td className="td text-right font-semibold">${fmt(item.cantidad * (item.recurso?.precio || 0))}</td>
                      <td className="td">
                        <button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Agregar item */}
          <div className="rounded-lg border-2 border-dashed border-slate-200 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Agregar recurso</p>
            <div className="flex gap-2 flex-wrap">
              <select
                className="input flex-1 min-w-[200px]"
                value={newItem.recurso_id}
                onChange={e => handleRecursoSelect(e.target.value)}
              >
                <option value="">Seleccionar recurso del catálogo...</option>
                {['Material','Mano de Obra','Equipo'].map(cat => (
                  <optgroup key={cat} label={cat}>
                    {recursos.filter(r => r.categoria?.nombre === cat).map(r => (
                      <option key={r.id} value={r.id}>{r.nombre} ({r.unidad}) — ${fmt(r.precio)}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <div className="flex flex-col gap-0.5">
                <input
                  className="input w-32" type="number" step="0.0001" min="0"
                  placeholder="Cantidad"
                  value={newItem.cantidad} onChange={e => setNewItem(n => ({ ...n, cantidad: e.target.value }))}
                />
                <p className="text-xs text-slate-400 text-center">por {apuForm.unidad || 'unidad'}</p>
              </div>
              <div className="flex flex-col gap-0.5">
                <input
                  className="input w-28" type="number" step="0.01" min="0"
                  placeholder="Rend. ref."
                  value={newItem.rendimiento} onChange={e => setNewItem(n => ({ ...n, rendimiento: e.target.value }))}
                />
                <p className="text-xs text-slate-400 text-center">referencia</p>
              </div>
              <button onClick={addItem} className="btn-primary">
                <Plus className="h-4 w-4" /> Agregar
              </button>
            </div>
            {newItem.recurso_id && (() => {
              const r = recursos.find(rec => rec.id === newItem.recurso_id)
              return r?.rendimiento_default != null ? (
                <p className="mt-2 flex items-center gap-1 text-xs text-blue-600">
                  <Info className="h-3.5 w-3.5" />
                  Rendimiento promedio de catálogo: {r.rendimiento_default} {r.rendimiento_descripcion || ''}
                </p>
              ) : null
            })()}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear APU'}
          </button>
        </div>
      </Modal>

      {/* Modal eliminar */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Eliminar APU" size="sm">
        <p className="text-sm text-slate-600">
          ¿Seguro que quieres eliminar el APU <strong>{deleting?.nombre}</strong>?
          Los proyectos que lo usen conservarán sus precios bloqueados.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => setDeleting(null)} className="btn-secondary">Cancelar</button>
          <button onClick={confirmDelete} className="btn-danger">Eliminar</button>
        </div>
      </Modal>
    </div>
  )
}
