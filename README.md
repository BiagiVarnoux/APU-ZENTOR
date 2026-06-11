# APU ZENTOR

Sistema de cotización por Análisis de Precios Unitarios para construcción.

## Configuración

### 1. Base de datos (Supabase)

1. Crea una cuenta en [supabase.com](https://supabase.com) y crea un nuevo proyecto.
2. En el panel de Supabase, ve a **SQL Editor → New Query**.
3. Pega el contenido de `supabase/schema.sql` y ejecuta. Esto crea todas las tablas.

### 2. Variables de entorno

1. Copia el archivo de ejemplo:
   ```bash
   cp .env.local.example .env.local
   ```
2. En Supabase, ve a **Settings → API** y copia:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. Correr localmente

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

### 4. Desplegar en Vercel

1. Sube este repositorio a GitHub.
2. Importa el proyecto en [vercel.com](https://vercel.com).
3. En Vercel, ve a **Settings → Environment Variables** y agrega las dos variables del paso 2.
4. Haz deploy.

---

## Estructura

| Sección | Descripción |
|---|---|
| **Catálogo** | Materiales, mano de obra y equipos con precios y rendimientos |
| **APUs** | Constructor de Análisis de Precios Unitarios |
| **Proyectos** | Presupuestos por proyecto con precios independientes |
