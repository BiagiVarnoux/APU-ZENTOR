-- ============================================================
--  APU ZENTOR — Schema completo
--  Ejecutar en: Supabase → SQL Editor → New Query
-- ============================================================

-- Extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- 1. Categorías de recursos
-- ─────────────────────────────────────────────────────────────
CREATE TABLE categorias (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre     TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO categorias (nombre) VALUES
  ('Material'),
  ('Mano de Obra'),
  ('Equipo');

-- ─────────────────────────────────────────────────────────────
-- 2. Catálogo de recursos
-- ─────────────────────────────────────────────────────────────
CREATE TABLE recursos (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre                   TEXT NOT NULL,
  unidad                   TEXT NOT NULL,
  precio                   NUMERIC(12,2) NOT NULL DEFAULT 0,
  categoria_id             UUID REFERENCES categorias(id),
  rendimiento_default      NUMERIC(10,4),          -- valor por defecto
  rendimiento_descripcion  TEXT,                   -- ej: "m²/m", "m²/gal"
  notas                    TEXT,
  activo                   BOOLEAN DEFAULT TRUE,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recursos_updated_at
  BEFORE UPDATE ON recursos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 3. Escenarios de rendimiento alternativos
-- ─────────────────────────────────────────────────────────────
CREATE TABLE rendimiento_escenarios (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recurso_id  UUID REFERENCES recursos(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,        -- ej: "Muro liso", "Muro rugoso"
  rendimiento NUMERIC(10,4) NOT NULL,
  descripcion TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 4. APUs (Análisis de Precios Unitarios)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE apus (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre      TEXT NOT NULL,
  unidad      TEXT NOT NULL,
  descripcion TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER apus_updated_at
  BEFORE UPDATE ON apus
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 5. Recursos dentro de un APU
-- ─────────────────────────────────────────────────────────────
CREATE TABLE apu_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  apu_id      UUID REFERENCES apus(id) ON DELETE CASCADE,
  recurso_id  UUID REFERENCES recursos(id),
  cantidad    NUMERIC(10,4) NOT NULL DEFAULT 1,
  rendimiento NUMERIC(10,4),   -- referencia de rendimiento usado
  orden       INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 6. Proyectos
-- ─────────────────────────────────────────────────────────────
CREATE TABLE proyectos (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre               TEXT NOT NULL,
  cliente              TEXT,
  descripcion          TEXT,
  estado               TEXT DEFAULT 'borrador'
                         CHECK (estado IN ('borrador', 'bloqueado', 'completado')),
  factor_indirecto     NUMERIC(5,2) DEFAULT 0,   -- % costos indirectos
  factor_utilidad      NUMERIC(5,2) DEFAULT 0,   -- % utilidad
  precios_bloqueados   BOOLEAN DEFAULT FALSE,
  bloqueado_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER proyectos_updated_at
  BEFORE UPDATE ON proyectos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 7. Partidas del presupuesto
-- ─────────────────────────────────────────────────────────────
CREATE TABLE partidas (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proyecto_id  UUID REFERENCES proyectos(id) ON DELETE CASCADE,
  apu_id       UUID REFERENCES apus(id),
  nombre       TEXT NOT NULL,
  descripcion  TEXT,
  unidad       TEXT NOT NULL,
  cantidad     NUMERIC(12,4) NOT NULL DEFAULT 1,
  orden        INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER partidas_updated_at
  BEFORE UPDATE ON partidas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 8. Snapshot de precios (cuando se bloquea un proyecto)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE partidas_snapshot (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partida_id          UUID UNIQUE REFERENCES partidas(id) ON DELETE CASCADE,
  precio_unitario_apu NUMERIC(12,2) NOT NULL,
  detalle             JSONB,   -- desglose completo de recursos con precios
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- RLS: Desactivado por defecto (app de equipo interno)
-- Activa Row Level Security en Supabase si necesitas control por usuario
-- ─────────────────────────────────────────────────────────────
