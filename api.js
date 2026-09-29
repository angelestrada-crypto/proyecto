/* Capa de datos: usa el servidor (Node/Express + SQLite) y, si no existe
   (por ejemplo en GitHub Pages), funciona en "modo demo" con localStorage. */
const Api = (() => {
  let modo = null;

  async function detectar() {
    if (modo) return modo;
    try {
      const r = await fetch('api/sesion', { credentials: 'same-origin' });
      const d = await r.json();
      modo = r.ok && 'autenticado' in d ? 'servidor' : 'demo';
    } catch { modo = 'demo'; }
    return modo;
  }

  // ---------- Modo servidor ----------
  async function http(metodo, url, cuerpo) {
    const r = await fetch(url, {
      method: metodo, credentials: 'same-origin',
      headers: cuerpo ? { 'Content-Type': 'application/json' } : {},
      body: cuerpo ? JSON.stringify(cuerpo) : undefined
    });
    let d = {}; try { d = await r.json(); } catch {}
    if (!r.ok) throw new Error(d.error || 'Error del servidor.');
    return d;
  }
  const remoto = {
    sesion: async () => (await http('GET', 'api/sesion')).usuario,
    login: (email, password, recordar) => http('POST', 'api/login', { email, password, recordar }),
    registro: d => http('POST', 'api/registro', d),
    logout: () => http('POST', 'api/logout'),
    resumen: () => http('GET', 'api/resumen'),
    usuarios: () => http('GET', 'api/usuarios'),
    listar: () => http('GET', 'api/productos'),
    obtener: sku => http('GET', 'api/productos/' + encodeURIComponent(sku)),
    crear: p => http('POST', 'api/productos', p),
    actualizar: (sku, p) => http('PUT', 'api/productos/' + encodeURIComponent(sku), p),
    eliminar: sku => http('DELETE', 'api/productos/' + encodeURIComponent(sku))
  };

  // ---------- Modo demo (localStorage) ----------
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const LS = {
    get: (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } },
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v))
  };
  async function sha(t) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  }
  async function iniciarDemo() {
    if (!LS.get('ip_usuarios', null))
      LS.set('ip_usuarios', [{ id: 1, nombres: 'Administrador', apellidos: 'Sistema',
        email: 'admin@inventariopro.com', hash: await sha('Admin123'), creado: new Date().toISOString() }]);
    if (!LS.get('ip_productos', null))
      LS.set('ip_productos', [{ sku: 'PROD-001', nombre: 'Teclado Mecánico RGB', categorias: ['Periféricos'],
        etiqueta: 'primary', disponibilidad: 'En Stock', publicado: true }]);
  }
  const validarProducto = (b, nuevo) => {
    if ((b.nombre || '').trim().length < 3) return 'El nombre del producto debe tener mínimo 3 caracteres.';
    if (nuevo && !/^[A-Z0-9-]{3,20}$/.test((b.sku || '').trim().toUpperCase())) return 'SKU no válido (3 a 20 caracteres: letras, números y guion).';
    if (!b.categorias || !b.categorias.length) return 'Seleccione al menos una categoría.';
    return null;
  };
  const demo = {
    sesion: async () => {
      await iniciarDemo();
      const id = sessionStorage.getItem('ip_sesion') || localStorage.getItem('ip_sesion');
      const u = LS.get('ip_usuarios', []).find(x => String(x.id) === id);
      return u ? { nombres: u.nombres, apellidos: u.apellidos, email: u.email } : null;
    },
    login: async (email, password, recordar) => {
      await iniciarDemo();
      const h = await sha(password || '');
      const u = LS.get('ip_usuarios', []).find(x => x.email === (email || '').trim().toLowerCase() && x.hash === h);
      if (!u) throw new Error('Correo o contraseña incorrectos.');
      (recordar ? localStorage : sessionStorage).setItem('ip_sesion', String(u.id));
      return { ok: true };
    },
    registro: async b => {
      await iniciarDemo();
      const us = LS.get('ip_usuarios', []);
      const p = b.password || '';
      if ((b.nombres || '').trim().length < 2) throw new Error('Ingrese sus nombres (mínimo 2 caracteres).');
      if ((b.apellidos || '').trim().length < 2) throw new Error('Ingrese sus apellidos (mínimo 2 caracteres).');
      if (!EMAIL.test((b.email || '').trim())) throw new Error('Correo electrónico no válido.');
      if (p.length < 8 || !/[A-Za-z]/.test(p) || !/\d/.test(p)) throw new Error('La contraseña debe tener mínimo 8 caracteres, con letras y números.');
      if (p !== b.confirmar) throw new Error('Las contraseñas no coinciden.');
      if (b.terminos !== true) throw new Error('Debe aceptar los términos y condiciones.');
      const email = b.email.trim().toLowerCase();
      if (us.some(x => x.email === email)) throw new Error('Ese correo ya está registrado.');
      us.push({ id: Date.now(), nombres: b.nombres.trim(), apellidos: b.apellidos.trim(), email, hash: await sha(p), creado: new Date().toISOString() });
      LS.set('ip_usuarios', us);
      return { ok: true };
    },
    logout: async () => { sessionStorage.removeItem('ip_sesion'); localStorage.removeItem('ip_sesion'); return { ok: true }; },
    resumen: async () => {
      const ps = LS.get('ip_productos', []);
      return { enStock: ps.filter(p => p.disponibilidad === 'En Stock').length,
               criticos: ps.filter(p => p.disponibilidad === 'Agotado').length,
               totalProductos: ps.length, totalUsuarios: LS.get('ip_usuarios', []).length };
    },
    usuarios: async () => LS.get('ip_usuarios', []).map(({ hash, ...u }) => u),
    listar: async () => LS.get('ip_productos', []),
    obtener: async sku => {
      const p = LS.get('ip_productos', []).find(x => x.sku === sku);
      if (!p) throw new Error('Producto no encontrado.');
      return p;
    },
    crear: async b => {
      const err = validarProducto(b, true); if (err) throw new Error(err);
      const ps = LS.get('ip_productos', []);
      const sku = b.sku.trim().toUpperCase();
      if (ps.some(p => p.sku === sku)) throw new Error('Ya existe un producto con ese SKU.');
      ps.unshift({ sku, nombre: b.nombre.trim(), categorias: b.categorias, etiqueta: b.etiqueta,
                   disponibilidad: b.disponibilidad, publicado: !!b.publicado });
      LS.set('ip_productos', ps); return { ok: true };
    },
    actualizar: async (sku, b) => {
      const err = validarProducto(b, false); if (err) throw new Error(err);
      const ps = LS.get('ip_productos', []);
      const p = ps.find(x => x.sku === sku);
      if (!p) throw new Error('Producto no encontrado.');
      Object.assign(p, { nombre: b.nombre.trim(), categorias: b.categorias, etiqueta: b.etiqueta, disponibilidad: b.disponibilidad });
      LS.set('ip_productos', ps); return { ok: true };
    },
    eliminar: async sku => {
      const ps = LS.get('ip_productos', []);
      if (!ps.some(p => p.sku === sku)) throw new Error('Producto no encontrado.');
      LS.set('ip_productos', ps.filter(p => p.sku !== sku)); return { ok: true };
    }
  };

  const api = { modo: detectar };
  for (const m of Object.keys(remoto))
    api[m] = async (...a) => ((await detectar()) === 'servidor' ? remoto : demo)[m](...a);
  return api;
})();
