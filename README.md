# Mahaia

Cartas digitales para restaurantes: alérgenos claros, siempre al día y en el idioma de cada cliente.

## Puesta en marcha en local

```bash
npm install
cp .env.example .env.local   # rellena la URL y la clave anon de Supabase
npm run dev                  # http://localhost:3000
```

## Base de datos (Supabase)

Las migraciones están en `supabase/migrations/` y se aplican **en orden** desde el SQL Editor de Supabase:

1. `20261115000000_esquema_inicial.sql`: tablas, RLS y políticas.
2. `20261115170000_guardar_alergenos.sql`: función atómica del checklist de alérgenos.

En **Authentication → URL Configuration**, añade `http://localhost:3000/auth/confirmar` a *Redirect URLs*.

## Comprobaciones

```bash
npm run typecheck   # tipos de rutas + tsc --noEmit
npm test            # tests de dominio, formularios y RLS (Postgres real con PGlite)
```
