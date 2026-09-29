/* Utilidades comunes de la interfaz */
const App = {
  alerta(id, tipo, texto) {
    const el = document.getElementById(id);
    el.className = `alert alert-${tipo} alert-dismissible fade show`;
    el.querySelector('.msg').textContent = texto;
  },
  async proteger() {
    const u = await Api.sesion().catch(() => null);
    if (!u) { location.href = 'login.html'; return null; }
    document.querySelectorAll('.nombre-usuario').forEach(e => e.textContent = u.nombres + ' ' + u.apellidos);
    document.querySelectorAll('.btn-salir').forEach(b => b.addEventListener('click', async () => {
      await Api.logout(); location.href = 'login.html';
    }));
    App.pie();
    return u;
  },
  async pie() {
    const el = document.getElementById('pie');
    if (el && (await Api.modo()) === 'demo')
      el.innerHTML = '<span class="badge text-bg-secondary">Modo demo: datos guardados en este navegador (sin servidor)</span>';
  },
  badgeDisp(d) {
    const c = { 'En Stock': 'success', 'Agotado': 'warning text-dark', 'Descontinuado': 'secondary' }[d] || 'secondary';
    return `<span class="badge bg-${c}">${d}</span>`;
  },
  esc: s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
};
