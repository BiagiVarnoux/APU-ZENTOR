'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Plus, Trash2, Lock, ArrowLeft, Pencil, AlertTriangle, CheckCircle, Info } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Proyecto, Partida, APU, APUDetalleSnapshot } from '@/lib/types'
import Modal from '@/components/modal'

const fmt = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function calcAPUPrice(apu: APU): number {
  return (apu.apu_items || []).reduce((sum, item) => sum + item.cantidad * (item.recurso?.precio || 0), 0)
}

export default function ProyectoDetallePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [proyecto, setProyecto] = useState<Proyecto | null>(null)
  const [partidas, setPartidas] = useState<Partida[]>([])
  const [apus, setApus] = useState<APU[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddPartida, setShowAddPartida] = useState(false)
  const [showEditProyecto, setShowEditProyecto] = useState(false)
  const [showLockConfirm, setShowLockConfirm] = useState(false)
  const [showDeletePartida, setShowDeletePartida] = useState<Partida | null>(null)
  const [saving, setSaving] = useState(false)
  const [locking, setLocking] = useState(false)
  const [error, setError] = useState('')

  const [partForm, setPartForm] = useState({ apu_id: '', nombre: '', descripcion: '', unidad: '', cantidad: '1' })
  const [editProyForm, setEditProyForm] = useState({
    nombre: '', cliente: '', descripcion: '', factor_indirecto: '0', factor_utilidad: '0'
  })

  const load = useCallback(async () => {
    setLoading(true)
    const { data: proy } = await supabase.from('proyectos').select('*').eq('id', id).single()
    if (!proy) { router.push('/proyectos'); return }
    setProyecto(proy)
    setEditProyForm({
      nombre: proy.nombre,
      cliente: proy.cliente || '',
      descripcion: proy.descripcion || '',
      factor_indirecto: String(proy.factor_indirecto),
      factor_utilidad: String(proy.factor_utilidad),
    })
    const { data: parts } = await supabase
      .from('partidas')
      .select('*, apu:apus(*, apu_items(*, recurso:recursos(*, categoria:categorias(nombre)))), partidas_snapshot(*)')
      .eq('proyecto_id', id)
      .order('orden')
    setPartidas(parts || [])
    const { data: apuData } = await supabase
      .from('apus')
      .select('*, apu_items(*, recurso:recursos(*, categoria:categorias(nombre)))')
      .order('nombre')
    setApus(apuData || [])
    setLoading(false)
  }, [id, router])

  useEffect(() => { load() }, [load])

  function handleAPUSelect(apuId: string) {
    const apu = apus.find(a => a.id === apuId)
    setPartForm(f => ({
      ...f,
      apu_id: apuId,
      nombre: apu?.nombre || '',
      unidad: apu?.unidad || '',
    }))
  }

  async function addPartida() {
    if (!partForm.apu_id || !partForm.nombre || !partForm.cantidad) {
      setError('Selecciona un APU y define el nombre y cantidad.')
      return
    }
    setSaving(true)
    const maxOrden = partidas.length > 0 ? Math.max(...partidas.map(p => p.orden)) + 1 : 0
    await supabase.from('partidas').insert({
      proyecto_id: id,
      apu_id: partForm.apu_id,
      nombre: partForm.nombre.trim(),
      descripcion: partForm.descripcion.trim() || null,
      unidad: partForm.unidad.trim(),
      cantidad: parseFloat(partForm.cantidad),
      orden: maxOrden,
    })
    setSaving(false)
    setShowAddPartida(false)
    setPartForm({ apu_id: '', nombre: '', descripcion: '', unidad: '', cantidad: '1' })
    setError('')
    load()
  }

  async function deletePartida() {
    if (!showDeletePartida) return
    await supabase.from('partidas').delete().eq('id', showDeletePartida.id)
    setShowDeletePartida(null)
    load()
  }

  async function saveEditProyecto() {
    if (!editProyForm.nombre.trim()) return
    setSaving(true)
    await supabase.from('proyectos').update({
      nombre: editProyForm.nombre.trim(),
      cliente: editProyForm.cliente.trim() || null,
      descripcion: editProyForm.descripcion.trim() || null,
      factor_indirecto: parseFloat(editProyForm.factor_indirecto) || 0,
      factor_utilidad: parseFloat(editProyForm.factor_utilidad) || 0,
    }).eq('id', id)
    setSaving(false)
    setShowEditProyecto(false)
    load()
  }

  async function lockPrecios() {
    setLocking(true)
    const snapshots = partidas.map(partida => {
      const apu = partida.apu
      if (!apu) return null
      const precioUnitarioApu = calcAPUPrice(apu)
      const detalle: APUDetalleSnapshot[] = (apu.apu_items || []).map(item => ({
        recurso_nombre: item.recurso?.nombre || '',
        recurso_unidad: item.recurso?.unidad || '',
        cantidad: item.cantidad,
        precio: item.recurso?.precio || 0,
        subtotal: item.cantidad * (item.recurso?.precio || 0),
      }))
      return { partida_id: partida.id, precio_unitario_apu: precioUnitarioApu, detalle }
    }).filter(Boolean)

    for (const snap of snapshots) {
      if (!snap) continue
      await supabase.from('partidas_snapshot').upsert(snap, { onConflict: 'partida_id' })
    }

    await supabase.from('proyectos').update({
      estado: 'bloqueado',
      precios_bloqueados: true,
      bloqueado_at: new Date().toISOString(),
    }).eq('id', id)

    setLocking(false)
    setShowLockConfirm(false)
    load()
  }

  // Calcular precio de una partida (usa snapshot si bloqueado)
  function getPartidaPrice(partida: Partida): number {
    if (proyecto?.precios_bloqueados && partida.partidas_snapshot?.[0]) {
      return partida.partidas_snapshot[0].precio_unitario_apu
    }
    return partida.apu ? calcAPUPrice(partida.apu) : 0
  }

  function getPartidaTotal(partida: Partida): number {
    return getPartidaPrice(partida) * partida.cantidad
  }

  const subtotal = partidas.reduce((sum, p) => sum + getPartidaTotal(p), 0)
  const indirecto = subtotal * ((proyecto?.factor_indirecto || 0) / 100)
  const utilidad = (subtotal + indirecto) * ((proyecto?.factor_utilidad || 0) / 100)
  const total = subtotal + indirecto + utilidad

  if (loading) return <div className="py-20 text-center text-sm text-slate-400">Cargando...</div>
  if (!proyecto) return null

  const bloqueado = proyecto.precios_bloqueados

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link href="/proyectos" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a Proyectos
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{proyecto.nombre}</h1>
              {bloqueado
                ? <span className="badge-bloqueado"><Lock className="h-3 w-3 mr-1" />Precios bloqueados</span>
                : <span className="badge-borrador">Borrador</span>}
            </div>
            {proyecto.cliente && <p className="mt-1 text-sm text-slate-500">Cliente: {proyecto.cliente}</p>}
            {proyecto.descripcion && <p className="mt-0.5 text-sm text-slate-400">{proyecto.descripcion}</p>}
            {bloqueado && proyecto.bloqueado_at && (
              <p className="mt-1 text-xs text-emerald-600">
                <CheckCircle className="h-3 w-3 inline mr-1" />
                Precios bloqueados el {new Date(proyecto.bloqueado_at).toLocaleDateString('es-MX', { dateStyle: 'long' })}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowEditProyecto(true)} className="btn-secondary">
              <Pencil className="h-4 w-4" /> Editar
            </button>
            {!bloqueado && (
              <button onClick={() => setShowAddPartida(true)} className="btn-secondary">
                <Plus className="h-4 w-4" /> Agregar partida
              </button>
            )}
            {!bloqueado && partidas.length > 0 && (
              <button onClick={() => setShowLockConfirm(true)} className="btn-success">
                <Lock className="h-4 w-4" /> Bloquear precios
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Aviso precios en vivo */}
      {!bloqueado && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          <Info className="h-4 w-4 flex-shrink-0" />
          Los precios se calculan en tiempo real del catálogo. Al bloquear, se guardarán una fotografía de los precios actuales para este proyecto.
        </div>
      )}

      {/* Tabla de partidas */}
      <div className="card overflow-hidden mb-6">
        {partidas.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            Sin partidas. Agrega la primera con el botón de arriba.
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th w-10">#</th>
                <th className="th">Descripción</th>
                <th className="th">APU</th>
                <th className="th">Unidad</th>
                <th className="th text-right">Cantidad</th>
                <th className="th text-right">P. Unitario</th>
                <th className="th text-right">Total</th>
                {!bloqueado && <th className="th w-10" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {partidas.map((partida, idx) => {
                const precio = getPartidaPrice(partida)
                const totalP = getPartidaTotal(partida)
                return (
                  <tr key={partida.id} className="hover:bg-slate-50 transition-colors">
                    <td className="td text-slate-400 text-center">{idx + 1}</td>
                    <td className="td">
                      <p className="font-medium text-slate-900">{partida.nombre}</p>
                      {partida.descripcion && <p className="text-xs text-slate-400">{partida.descripcion}</p>}
                    </td>
                    <td className="td text-slate-500 text-sm">{partida.apu?.nombre}</td>
                    <td className="td text-slate-500">{partida.unidad}</td>
                    <td className="td text-right">{partida.cantidad.toLocaleString('es-MX')}</td>
                    <td className="td text-right">
                      <span className={bloqueado ? 'text-emerald-700 font-semibold' : 'text-slate-700'}>
                        ${fmt(precio)}
                      </span>
                    </td>
                    <td className="td text-right font-bold text-slate-900">${fmt(totalP)}</td>
                    {!bloqueado && (
                      <td className="td">
                        <button onClick={() => setShowDeletePartida(partida)} className="rounded p-1.5 text-slate-300 hover:bg-slate-100 hover:text-red-600 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Resumen de totales */}
      {partidas.length > 0 && (
        <div className="flex justify-end">
          <div className="card w-80 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Resumen del presupuesto</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Costo directo</span>
                <span className="font-medium">${fmt(subtotal)}</span>
              </div>
              {proyecto.factor_indirecto > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Costos indirectos ({proyecto.factor_indirecto}%)</span>
                  <span className="font-medium">${fmt(indirecto)}</span>
                </div>
              )}
              {proyecto.factor_utilidad > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Utilidad ({proyecto.factor_utilidad}%)</span>
                  <span className="font-medium">${fmt(utilidad)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-3 mt-3">
                <span className="font-bold text-slate-900">TOTAL</span>
                <span className="font-bold text-xl text-blue-700">${fmt(total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal agregar partida */}
      <Modal open={showAddPartida} onClose={() => { setShowAddPartida(false); setError('') }} title="Agregar Partida" size="md">
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {error}
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="label">APU a utilizar *</label>
            <select className="input" value={partForm.apu_id} onChange={e => handleAPUSelect(e.target.value)}>
              <option value="">Seleccionar APU...</option>
              {apus.map(a => (
                <option key={a.id} value={a.id}>
                  {a.nombre} — ${fmt(calcAPUPrice(a))}/{a.unidad}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Nombre de la partida *</label>
            <input className="input" placeholder="Descripción de la partida en este proyecto" value={partForm.nombre} onChange={e => setPartForm(f => ({ ...f, nombre: e.target.value }))} />
          </div>
          <div>
            <label className="label">Descripción</label>
            <input className="input" placeholder="Especificación adicional (opcional)" value={partForm.descripcion} onChange={e => setPartForm(f => ({ ...f, descripcion: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Unidad</label>
              <input className="input" placeholder="m², m, pza..." value={partForm.unidad} onChange={e => setPartForm(f => ({ ...f, unidad: e.target.value }))} />
            </div>
            <div>
              <label className="label">Cantidad *</label>
              <input className="input" type="number" min="0" step="0.01" placeholder="0" value={partForm.cantidad} onChange={e => setPartForm(f => ({ ...f, cantidad: e.target.value }))} />
            </div>
          </div>
          {partForm.apu_id && (() => {
            const apu = apus.find(a => a.id === partForm.apu_id)
            const precio = apu ? calcAPUPrice(apu) : 0
            const total = precio * (parseFloat(partForm.cantidad) || 0)
            return (
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
                Precio unitario actual: <strong>${fmt(precio)}</strong> &nbsp;·&nbsp; Total estimado: <strong>${fmt(total)}</strong>
              </div>
            )
          })()}
        </div>
        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button onClick={() => { setShowAddPartida(false); setError('') }} className="btn-secondary">Cancelar</button>
          <button onClick={addPartida} disabled={saving} className="btn-primary">
            {saving ? 'Agregando...' : 'Agregar partida'}
          </button>
        </div>
      </Modal>

      {/* Modal editar proyecto */}
      <Modal open={showEditProyecto} onClose={() => setShowEditProyecto(false)} title="Editar Proyecto" size="md">
        <div className="space-y-4">
          <div>
            <label className="label">Nombre *</label>
            <input className="input" value={editProyForm.nombre} onChange={e => setEditProyForm(f => ({ ...f, nombre: e.target.value }))} />
          </div>
          <div>
            <label className="label">Cliente</label>
            <input className="input" value={editProyForm.cliente} onChange={e => setEditProyForm(f => ({ ...f, cliente: e.target.value }))} />
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input resize-none h-20" value={editProyForm.descripcion} onChange={e => setEditProyForm(f => ({ ...f, descripcion: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Costos indirectos (%)</label>
              <input className="input" type="number" min="0" max="100" step="0.5" value={editProyForm.factor_indirecto} onChange={e => setEditProyForm(f => ({ ...f, factor_indirecto: e.target.value }))} />
            </div>
            <div>
              <label className="label">Utilidad (%)</label>
              <input className="input" type="number" min="0" max="100" step="0.5" value={editProyForm.factor_utilidad} onChange={e => setEditProyForm(f => ({ ...f, factor_utilidad: e.target.value }))} />
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button onClick={() => setShowEditProyecto(false)} className="btn-secondary">Cancelar</button>
          <button onClick={saveEditProyecto} disabled={saving} className="btn-primary">
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </Modal>

      {/* Modal bloquear precios */}
      <Modal open={showLockConfirm} onClose={() => setShowLockConfirm(false)} title="Bloquear precios del proyecto" size="sm">
        <div className="space-y-3 text-sm text-slate-600">
          <p>Al bloquear los precios de <strong>{proyecto.nombre}</strong>:</p>
          <ul className="space-y-1 pl-4 list-disc text-slate-500">
            <li>Se guardarán <strong>todos los precios actuales</strong> del catálogo como fotografía de este proyecto.</li>
            <li>Si cambias el precio de un material en el catálogo, <strong>este proyecto NO se verá afectado</strong>.</li>
            <li>No podrás agregar ni eliminar partidas.</li>
          </ul>
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-amber-700 text-xs">
            Esta acción no se puede deshacer. Asegúrate de que los precios del catálogo estén actualizados antes de continuar.
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => setShowLockConfirm(false)} className="btn-secondary">Cancelar</button>
          <button onClick={lockPrecios} disabled={locking} className="btn-success">
            {locking ? 'Bloqueando...' : <><Lock className="h-4 w-4" /> Confirmar y bloquear</>}
          </button>
        </div>
      </Modal>

      {/* Modal eliminar partida */}
      <Modal open={!!showDeletePartida} onClose={() => setShowDeletePartida(null)} title="Eliminar partida" size="sm">
        <p className="text-sm text-slate-600">
          ¿Seguro que quieres eliminar la partida <strong>{showDeletePartida?.nombre}</strong>?
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => setShowDeletePartida(null)} className="btn-secondary">Cancelar</button>
          <button onClick={deletePartida} className="btn-danger">Eliminar</button>
        </div>
      </Modal>
    </div>
  )
}
