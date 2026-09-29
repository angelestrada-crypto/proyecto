-- InventarioPro - Esquema de base de datos (SQLite)
CREATE TABLE IF NOT EXISTS usuarios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombres       TEXT NOT NULL,
  apellidos     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  creado        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS productos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  sku            TEXT NOT NULL UNIQUE,
  nombre         TEXT NOT NULL,
  categorias     TEXT NOT NULL,
  etiqueta       TEXT NOT NULL DEFAULT 'primary',
  disponibilidad TEXT NOT NULL DEFAULT 'En Stock'
                 CHECK (disponibilidad IN ('En Stock','Agotado','Descontinuado')),
  publicado      INTEGER NOT NULL DEFAULT 1,
  creado         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
