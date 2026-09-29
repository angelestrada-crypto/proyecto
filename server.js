const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const app = express();
const db = new Database(process.env.DB_FILE || path.join(__dirname, 'inventariopro.db'));
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(path.join(__dirname, 'database', 'schema.sql'), 'utf8'));

// Datos iniciales
if (db.prepare('SELECT COUNT(*) n FROM usuarios').get().n === 0) {
  db.prepare('INSERT INTO usuarios (nombres, apellidos, email, password_hash) VALUES (?,?,?,?)')
    .run('Administrador', 'Sistema', 'admin@inventariopro.com', bcrypt.hashSync('Admin123', 10));
}
if (db.prepare('SELECT COUNT(*) n FROM productos').get().n === 0) {
  db.prepare('INSERT INTO productos (sku, nombre, categorias, etiqueta, disponibilidad, publicado) VALUES (?,?,?,?,?,?)')
    .run('PROD-001', 'Teclado Mecánico RGB', JSON.stringify(['Periféricos']), 'primary', 'En Stock', 1);
}

// ---------- Validaciones (backend) ----------
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SKU = /^[A-Z0-9-]{3,20}$/;
const DISP = ['En Stock', 'Agotado', 'Descontinuado'];
const ETIQ = ['primary', 'success', 'warning', 'danger', 'info', 'secondary'];
const txt = v => (typeof v === 'string' ? v.trim() : '');

function validarRegistro(b) {
  if (txt(b.nombres).length < 2) return 'Ingrese sus nombres (mínimo 2 caracteres).';
  if (txt(b.apellidos).length < 2) return 'Ingrese sus apellidos (mínimo 2 caracteres).';
  if (!EMAIL.test(txt(b.email))) return 'Correo electrónico no válido.';
  const p = b.password || '';
  if (p.length < 8 || !/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'La contraseña debe tener mínimo 8 caracteres, con letras y números.';
  if (p !== b.confirmar) return 'Las contraseñas no coinciden.';
  if (b.terminos !== true) return 'Debe aceptar los términos y condiciones.';
  return null;
}
function validarProducto(b, nuevo) {
  if (txt(b.nombre).length < 3) return 'El nombre del producto debe tener mínimo 3 caracteres.';
  if (nuevo && !SKU.test(txt(b.sku).toUpperCase())) return 'SKU no válido (3 a 20 caracteres: letras, números y guion).';
  if (!Array.isArray(b.categorias) || b.categorias.length === 0) return 'Seleccione al menos una categoría.';
  if (!DISP.includes(b.disponibilidad)) return 'Disponibilidad no válida.';
  if (!ETIQ.includes(b.etiqueta)) return 'Etiqueta visual no válida.';
  return null;
}
const fila = r => r && { sku: r.sku, nombre: r.nombre, categorias: JSON.parse(r.categorias),
  etiqueta: r.etiqueta, disponibilidad: r.disponibilidad, publicado: !!r.publicado };

// ---------- Middlewares ----------
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'inventariopro-cambiar-en-produccion',
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax' }
}));
const auth = (req, res, next) =>
  req.session.uid ? next() : res.status(401).json({ error: 'Sesión no iniciada.' });

// ---------- Autenticación ----------
app.get('/api/sesion', (req, res) => {
  const u = req.session.uid && db.prepare('SELECT nombres, apellidos, email FROM usuarios WHERE id=?').get(req.session.uid);
  res.json({ autenticado: !!u, usuario: u || null });
});

app.post('/api/registro', (req, res) => {
  const b = req.body || {};
  const err = validarRegistro(b);
  if (err) return res.status(400).json({ error: err });
  try {
    db.prepare('INSERT INTO usuarios (nombres, apellidos, email, password_hash) VALUES (?,?,?,?)')
      .run(txt(b.nombres), txt(b.apellidos), txt(b.email).toLowerCase(), bcrypt.hashSync(b.password, 10));
    res.status(201).json({ ok: true });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'Ese correo ya está registrado.' });
    res.status(500).json({ error: 'Error al registrar.' });
  }
});

app.post('/api/login', (req, res) => {
  const { email, password, recordar } = req.body || {};
  const u = db.prepare('SELECT * FROM usuarios WHERE email=?').get(txt(email).toLowerCase());
  if (!u || !bcrypt.compareSync(password || '', u.password_hash))
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  req.session.regenerate(() => {
    req.session.uid = u.id;
    if (recordar) req.session.cookie.maxAge = 30 * 24 * 3600 * 1000;
    res.json({ ok: true, usuario: { nombres: u.nombres, apellidos: u.apellidos, email: u.email } });
  });
});

app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));

// ---------- Panel ----------
app.get('/api/resumen', auth, (req, res) => {
  const n = w => db.prepare(`SELECT COUNT(*) n FROM productos ${w}`).get().n;
  res.json({
    enStock: n("WHERE disponibilidad='En Stock'"),
    criticos: n("WHERE disponibilidad='Agotado'"),
    totalProductos: n(''),
    totalUsuarios: db.prepare('SELECT COUNT(*) n FROM usuarios').get().n
  });
});

app.get('/api/usuarios', auth, (req, res) =>
  res.json(db.prepare('SELECT id, nombres, apellidos, email, creado FROM usuarios ORDER BY id').all()));

// ---------- CRUD Productos ----------
app.get('/api/productos', auth, (req, res) =>
  res.json(db.prepare('SELECT * FROM productos ORDER BY id DESC').all().map(fila)));

app.get('/api/productos/:sku', auth, (req, res) => {
  const p = fila(db.prepare('SELECT * FROM productos WHERE sku=?').get(req.params.sku));
  p ? res.json(p) : res.status(404).json({ error: 'Producto no encontrado.' });
});

app.post('/api/productos', auth, (req, res) => {
  const b = req.body || {};
  const err = validarProducto(b, true);
  if (err) return res.status(400).json({ error: err });
  try {
    db.prepare('INSERT INTO productos (sku, nombre, categorias, etiqueta, disponibilidad, publicado) VALUES (?,?,?,?,?,?)')
      .run(txt(b.sku).toUpperCase(), txt(b.nombre), JSON.stringify(b.categorias), b.etiqueta, b.disponibilidad, b.publicado ? 1 : 0);
    res.status(201).json({ ok: true });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe un producto con ese SKU.' });
    res.status(500).json({ error: 'Error al guardar.' });
  }
});

app.put('/api/productos/:sku', auth, (req, res) => {
  const b = req.body || {};
  const err = validarProducto(b, false);
  if (err) return res.status(400).json({ error: err });
  // El SKU no se modifica (integridad de datos)
  const r = db.prepare('UPDATE productos SET nombre=?, categorias=?, etiqueta=?, disponibilidad=? WHERE sku=?')
    .run(txt(b.nombre), JSON.stringify(b.categorias), b.etiqueta, b.disponibilidad, req.params.sku);
  r.changes ? res.json({ ok: true }) : res.status(404).json({ error: 'Producto no encontrado.' });
});

app.delete('/api/productos/:sku', auth, (req, res) => {
  const r = db.prepare('DELETE FROM productos WHERE sku=?').run(req.params.sku);
  r.changes ? res.json({ ok: true }) : res.status(404).json({ error: 'Producto no encontrado.' });
});

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`InventarioPro en http://localhost:${PORT}`));
