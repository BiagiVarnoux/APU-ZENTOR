export interface Categoria {
  id: string
  nombre: string
}

export interface RendimientoEscenario {
  id: string
  recurso_id: string
  nombre: string
  rendimiento: number
  descripcion: string | null
}

export interface Recurso {
  id: string
  nombre: string
  unidad: string
  precio: number
  categoria_id: string | null
  categoria?: Categoria
  rendimiento_default: number | null
  rendimiento_descripcion: string | null
  notas: string | null
  activo: boolean
  rendimiento_escenarios?: RendimientoEscenario[]
}

export interface APUItem {
  id: string
  apu_id: string
  recurso_id: string
  recurso?: Recurso
  cantidad: number
  rendimiento: number | null
  orden: number
}

export interface APU {
  id: string
  nombre: string
  unidad: string
  descripcion: string | null
  apu_items?: APUItem[]
  precio_unitario?: number
}

export interface PartidaSnapshot {
  id: string
  partida_id: string
  precio_unitario_apu: number
  detalle: APUDetalleSnapshot[] | null
}

export interface APUDetalleSnapshot {
  recurso_nombre: string
  recurso_unidad: string
  cantidad: number
  precio: number
  subtotal: number
}

export interface Partida {
  id: string
  proyecto_id: string
  apu_id: string
  apu?: APU
  nombre: string
  descripcion: string | null
  unidad: string
  cantidad: number
  orden: number
  partidas_snapshot?: PartidaSnapshot[]
}

export interface Proyecto {
  id: string
  nombre: string
  cliente: string | null
  descripcion: string | null
  estado: 'borrador' | 'bloqueado' | 'completado'
  factor_indirecto: number
  factor_utilidad: number
  precios_bloqueados: boolean
  bloqueado_at: string | null
  created_at: string
  partidas?: Partida[]
}
