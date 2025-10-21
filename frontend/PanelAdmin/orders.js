// Gestión de Pedidos (Backend)
// Estados: espera -> preparando -> listo -> retirado
// Ahora consume API REST en lugar de localStorage

// Envolver todo en DOMContentLoaded para asegurar que el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {

const API_BASE = (window.APP_CONFIG?.API_BASE) || 'http://localhost:4000/api';
let pedidos = [];
let pedidosPreviosMap = new Map(); // para detectar cambios en paymentStatus

const formPedido = document.getElementById('form-nuevo-pedido');
const selectProducto = document.getElementById('pedido-producto');
const precioAuto = document.getElementById('pedido-precio');
const catAuto = document.getElementById('pedido-categoria');
const tbodyPedidos = document.querySelector('#tabla-pedidos tbody');
const filtroPedidos = document.getElementById('filtro-pedidos');
const btnLimpiarPedidos = document.getElementById('limpiar-pedidos');
const btnRefrescar = document.getElementById('refrescar-pedidos');

console.log('[ORDERS.JS] DOM Ready - tbodyPedidos:', tbodyPedidos);
console.log('[ORDERS.JS] Tabla encontrada:', !!tbodyPedidos);

// Etiquetas y estados
const etiquetasEstado = {
  espera: 'En espera',
  preparando: 'Preparando',
  listo: 'Listo',
  retirado: 'Retirado'
};
const estadosSecuenciales = ['espera','preparando','listo','retirado'];

const statusBanner = (() => {
  let el = document.getElementById('orders-status');
  if (!el) {
    el = document.createElement('div');
    el.id = 'orders-status';
    el.style.cssText = 'margin:8px 0;padding:8px 12px;border-radius:6px;font-size:0.85rem;display:none;font-weight:600;';
    const header = document.querySelector('#tab-pedidos h2');
    if (header && header.parentElement) {
      header.insertAdjacentElement('afterend', el);
    } else {
      document.body.insertBefore(el, document.body.firstChild);
    }
  }
  return el;
})();

function showStatus(message, tone = 'info') {
  if (!statusBanner) return;
  if (!message) {
    statusBanner.style.display = 'none';
    statusBanner.textContent = '';
    return;
  }
  const palette = {
    info: ['#e0f2fe', '#0c4a6e'],
    success: ['#dcfce7', '#166534'],
    warn: ['#fef3c7', '#92400e'],
    error: ['#fee2e2', '#b91c1c']
  };
  const [bg, fg] = palette[tone] || palette.info;
  statusBanner.style.background = bg;
  statusBanner.style.color = fg;
  statusBanner.style.display = 'block';
  statusBanner.textContent = message;
}

// ====== Asegurar sección/tabla visibles y presentes ======
function ensurePedidosSectionVisible(){
  const sec = document.getElementById('tab-pedidos');
  if (sec) {
    sec.classList.add('active');
    sec.style.display = 'block';
  }
}

function ensurePedidosTable(){
  ensurePedidosSectionVisible();
  let table = document.getElementById('tabla-pedidos');
  if (!table) {
    const sec = document.getElementById('tab-pedidos') || document.querySelector('main') || document.body;
    table = document.createElement('table');
    table.id = 'tabla-pedidos';
    table.className = 'tabla';
    table.innerHTML = `
      <thead>
        <tr>
          <th>#</th>
          <th>Cliente</th>
          <th>Items</th>
          <th>Importe</th>
          <th>Estado</th>
          <th>Pago</th>
          <th>Acciones</th>
          <th>Creación</th>
          <th>Eliminar</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const wrap = document.createElement('section');
    wrap.className = 'card';
    wrap.appendChild(table);
    sec.appendChild(wrap);
  }
  // Asegurar tbody
  let tbody = table.querySelector('tbody');
  if (!tbody) {
    tbody = document.createElement('tbody');
    table.appendChild(tbody);
  }
  // Asegurar visibilidad
  table.style.display = 'table';
  const cs = getComputedStyle(table);
  if (cs.display === 'none') table.style.display = 'table';
  return tbody;
}

async function cargarPedidos(){
  try {
    console.log('[PEDIDOS] API_BASE:', API_BASE);
    
    // No enviar headers de autenticación ya que el endpoint no lo requiere
    const url = API_BASE + '/orders';
    console.log('[PEDIDOS] URL completa:', url);
    showStatus('Cargando pedidos...', 'info');

    const r = await fetch(url, { cache:'no-store' });
    console.log('[PEDIDOS] Response status:', r.status, r.statusText);

    if (r.status === 401) {
      console.error('[PEDIDOS] El backend rechazó la petición (401) - reintentando sin token.');
      // Reintentar sin headers
      const r2 = await fetch(url, { cache:'no-store', headers: {} });
      if(!r2.ok) {
        showStatus('No se pudieron cargar los pedidos. Error del servidor.', 'error');
        pedidos = [];
        return;
      }
      const data2 = await r2.json();
      if(!Array.isArray(data2)){
        showStatus('Respuesta inesperada del backend.', 'error');
        pedidos = [];
        return;
      }
      pedidos = data2;
      window.__debugPedidos = pedidos;
      console.log('[ADMIN PEDIDOS] Cargados (sin token):', pedidos.length, 'pedidos');
      showStatus(`Pedidos cargados correctamente: ${pedidos.length}`, pedidos.length ? 'success' : 'info');
      return;
    }

    if(!r.ok) throw new Error('HTTP '+r.status);
    const data = await r.json();
    if(!Array.isArray(data)){
      console.error('[PEDIDOS] Respuesta inesperada (no es array):', data);
      showStatus('Respuesta inesperada del backend al cargar pedidos.', 'error');
      pedidos = [];
      return;
    }
    pedidos = data;
    window.__debugPedidos = pedidos;
    console.log('[ADMIN PEDIDOS] Cargados:', pedidos.length, 'pedidos');
    showStatus(`Pedidos cargados correctamente: ${pedidos.length}`, pedidos.length ? 'success' : 'info');
  } catch(e){
    console.error('[PEDIDOS] No se pudieron cargar pedidos:', e);
    console.error('[PEDIDOS] Error completo:', e.message);
    pedidos = [];
    showStatus('No se pudieron cargar los pedidos. Revisa la consola para más detalles.', 'error');
  }
}

// ======= Notificación Sonora =======
let __adminAudioCtx = null;
let __adminInitialized = false; // evitar sonido en el primer render
function playNotify(kind){
  try {
    if(!__adminAudioCtx){ __adminAudioCtx = new (window.AudioContext||window.webkitAudioContext)(); }
    const ctx = __adminAudioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(kind==='payment' ? 1200 : 900, now);
    gain.gain.setValueAtTime(0.0001, now);
    osc.connect(gain); gain.connect(ctx.destination);
    // Envolvente corta
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.start(now);
    osc.stop(now + 0.2);
  } catch {}
}

async function cargarProductosParaSelect(){
  if(!selectProducto) return;
  try{
    const prods = await fetch(API_BASE + '/products', { headers: { ...(window.getAdminAuthHeaders?.()||{}) } }).then(r=>r.json());
    // Cache local para consulta rápida de precio/cat
    window.__ADMIN_PRODS = prods.reduce((acc,p)=>{ acc[p.id]=p; return acc; },{});
    selectProducto.innerHTML = '<option value="">Seleccione un producto</option>' +
      prods.map(p => `<option value="${p.id}">${p.nombre} — $${Number(p.precio||0).toFixed(2)}</option>`).join('');
    // Prellenar si hay uno seleccionado
    actualizarAutoFields();
  }catch{
    selectProducto.innerHTML = '<option value="">No se pudieron cargar productos</option>';
  }
}

function actualizarAutoFields(){
  if(!selectProducto) return;
  const id = selectProducto.value;
  const p = (window.__ADMIN_PRODS||{})[id];
  if(precioAuto) precioAuto.value = p ? `$ ${Number(p.precio||0).toFixed(2)}` : '';
  if(catAuto) catAuto.value = p ? (p.categoria || '-') : '';
}

async function crearPedidoManual(data){
  // Para mantener compatibilidad, creamos un pedido con 1 item artificial si no se especifica
  // Lo ideal es tener un selector de producto. Aquí usamos un productId ficticio imposible de descontar (backend lo rechazará si no existe)
  if(!data.productId){
    alert('Para crear pedidos manuales necesitas un productId válido (adapta el formulario).');
    return;
  }
  const body = {
    cliente: data.cliente || '',
    items: [{ productId: data.productId, cantidad: data.cantidad || 1 }]
  };
  const r = await fetch(API_BASE + '/orders', {
    method:'POST', headers:{'Content-Type':'application/json', ...(window.getAdminAuthHeaders?.()||{})}, body: JSON.stringify(body)
  });
  if(!r.ok){
    const err = await r.json().catch(()=>({error:'Error'}));
    alert('Error creando pedido: ' + err.error);
    return;
  }
  await cargarPedidos();
  renderPedidos();
}
async function cambiarEstado(id, nuevo){
  const headers = {'Content-Type':'application/json', ...(window.getAdminAuthHeaders?.()||{})};
  const r = await fetch(`${API_BASE}/orders/${id}/state`, { method:'PATCH', headers, body: JSON.stringify({ estado: nuevo }) });
  if(!r.ok){ const err = await r.json().catch(()=>({error:'Error'})); alert('Error cambiando estado: ' + (err.error||r.status)); return; }
  await cargarPedidos();
  renderPedidos();
}

async function eliminarPedido(id){
  const headers = {...(window.getAdminAuthHeaders?.()||{})};
  const r = await fetch(`${API_BASE}/orders/${id}`, { method:'DELETE', headers });
  if(!r.ok){ const err = await r.json().catch(()=>({error:'Error'})); alert('Error eliminando: ' + (err.error||r.status)); return; }
  await cargarPedidos();
  renderPedidos();
}

function crearBotonesEstados(p) {
  const cont = document.createElement('div');
  cont.className = 'acciones';
  estadosSecuenciales.forEach(est => {
    const b = document.createElement('button');
    b.textContent = etiquetasEstado[est].split(' ')[0];
    b.title = etiquetasEstado[est];
    if (p.estado === est) b.classList.add('active');
    b.addEventListener('click', () => cambiarEstado(p.id, est));
    cont.appendChild(b);
  });
  return cont;
}

function renderPedidos() {
  // Asegurar que el tbody exista y sea visible
  const tbody = ensurePedidosTable();

  // Render limpio: sin fila de prueba

  //console.log('[RENDER] Iniciando render con', pedidos.length, 'pedidos totales');
  tbody.innerHTML='';
  let filtrado = pedidos;
  const f = filtroPedidos ? filtroPedidos.value.trim().toLowerCase() : '';
  if (f) {
    filtrado = pedidos.filter(p=>
      (p.id||'').toLowerCase().includes(f) ||
      (p.cliente||'').toLowerCase().includes(f) ||
      p.items?.some(it => (it.nombre||'').toLowerCase().includes(f))
    );
  }
  
  //console.log('[RENDER] Total pedidos:', pedidos.length, 'Filtrados:', filtrado.length);
  
  if (!filtrado.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 9;
    if (pedidos.length > 0) {
      // Render de respaldo: mostrar todos los pedidos en texto plano
      td.innerHTML = '<pre style="font-size:10px;max-height:300px;overflow:auto;">' + JSON.stringify(pedidos, null, 2) + '</pre>';
    } else {
      td.innerHTML = '<div class="empty-msg">Sin pedidos por el momento.</div>';
    }
    tr.appendChild(td); tbody.appendChild(tr); return;
  }

  // Flags para notificar una sola vez por render
  let notifyNew = false;
  let notifyPay = false;

  filtrado.forEach((p, i) => {
    const listaItems = (p.items||[]).map(it => `${it.nombre||it.productId} x${it.cantidad}`).join('<br>');
    const tr = document.createElement('tr');
    const pay = p.paymentStatus || 'pending';
    const payColor = pay === 'approved' ? '#2ecc71' : (pay === 'rejected' ? '#e74c3c' : '#f1c40f');
    const previo = pedidosPreviosMap.get(p.id);
    const isNew = !pedidosPreviosMap.has(p.id) && __adminInitialized;
    const changed = __adminInitialized && previo && previo !== pay;
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${p.cliente||''}</td>
      <td>${listaItems}</td>
      <td>${(p.importe||0).toFixed(2)}</td>
      <td><span class="badge ${p.estado}">${etiquetasEstado[p.estado]||p.estado}</span></td>
      <td><span class="badge badge-pay" data-pay="${pay}" style="background:${payColor};color:#111;font-weight:600;">${pay}</span></td>
      <td class="td-acciones"></td>
      <td>${new Date(p.fechaCreacion).toLocaleTimeString()}</td>
      <td><button class="danger small" data-del="${p.id}">X</button></td>
    `;
    if(changed){
      tr.classList.add('pay-changed');
      setTimeout(()=> tr.classList.remove('pay-changed'), 4000);
      notifyPay = true;
    }
    if(isNew){ notifyNew = true; }
    pedidosPreviosMap.set(p.id, pay);
    tbody.appendChild(tr);
    tr.querySelector('.td-acciones').appendChild(crearBotonesEstados(p));
  });

  // Eliminar entradas antiguas del mapa que ya no están
  const currentIds = new Set(pedidos.map(p=>p.id));
  for(const id of Array.from(pedidosPreviosMap.keys())){
    if(!currentIds.has(id)) pedidosPreviosMap.delete(id);
  }

  tbody.querySelectorAll('button[data-del]').forEach(btn => {
    btn.addEventListener('click', () => eliminarPedido(btn.dataset.del));
  });

  updateDebug();

  // Disparar sonidos (evitar primer render)
  if(__adminInitialized){
    if(notifyNew) playNotify('new');
    else if(notifyPay) playNotify('payment');
  }
  __adminInitialized = true;
}

// Formulario manual (requiere adaptar HTML para incluir productId y cantidad)
if(formPedido){
  formPedido.addEventListener('submit', async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(formPedido).entries());
    data.cantidad = parseInt(data.cantidad||'1');
    await crearPedidoManual(data);
    formPedido.reset();
    await cargarProductosParaSelect();
  });
}

if(selectProducto){
  selectProducto.addEventListener('change', actualizarAutoFields);
}

if (btnLimpiarPedidos) {
  btnLimpiarPedidos.addEventListener('click', async () => {
    if(!pedidos.length) return;
    if(!confirm('Eliminar TODOS los pedidos?')) return;
    // Eliminar uno por uno (sencillo); para optimizar crear endpoint bulk
    for(const p of pedidos){
  await fetch(`${API_BASE}/orders/${p.id}`, { method:'DELETE', headers: { ...(window.getAdminAuthHeaders?.()||{}) } });
    }
    await cargarPedidos();
    renderPedidos();
  });
}
if (btnRefrescar) btnRefrescar.addEventListener('click', async () => { await cargarPedidos(); renderPedidos(); });

// ================= Debug Panel Adaptado =================
const debugToggle = document.getElementById('debug-toggle');
const debugPanel = document.getElementById('debug-panel');
const debugJson = document.getElementById('debug-json');
const debugCerrar = document.getElementById('debug-cerrar');
const debugRecargar = document.getElementById('debug-recargar');
const debugCopiar = document.getElementById('debug-copiar');
const debugTest = document.getElementById('debug-test');
const debugExport = document.getElementById('debug-export');
const debugDelTest = document.getElementById('debug-deltest');

function updateDebug(){
  if(!debugPanel || debugPanel.hidden) return; 
  try { debugJson.textContent = JSON.stringify(pedidos, null, 2); } catch(e){ debugJson.textContent = 'Error serializando: '+e.message; }
}
function toggleDebug(force){
  if(!debugPanel) return;
  if(typeof force === 'boolean') debugPanel.hidden = !force; else debugPanel.hidden = !debugPanel.hidden;
  updateDebug();
}
if (debugToggle) debugToggle.addEventListener('click', () => toggleDebug());
if (debugCerrar) debugCerrar.addEventListener('click', () => toggleDebug(false));
if (debugRecargar) debugRecargar.addEventListener('click', async () => { await cargarPedidos(); renderPedidos(); });
if (debugCopiar) debugCopiar.addEventListener('click', () => {
  try { navigator.clipboard.writeText(JSON.stringify(pedidos, null, 2)); debugCopiar.textContent='Copiado'; setTimeout(()=>debugCopiar.textContent='Copiar JSON',1500);} catch(e){ alert('No se pudo copiar'); }
});

if (debugTest) debugTest.addEventListener('click', async () => {
  // Crear pedido de prueba (requiere productId real; tomamos el primero disponible)
  let firstProductId = null;
  try {
  const prods = await fetch(API_BASE + '/products', { headers: { ...(window.getAdminAuthHeaders?.()||{}) } }).then(r=>r.json()).catch(()=>[]);
    if(prods.length) firstProductId = prods[0].id;
  } catch{}
  if(!firstProductId){ alert('No hay productos para generar pedido de prueba'); return; }
  const body = { cliente: 'Test '+new Date().toLocaleTimeString(), items:[{ productId:firstProductId, cantidad:1 }]};
  const r = await fetch(API_BASE + '/orders', { method:'POST', headers:{'Content-Type':'application/json', ...(window.getAdminAuthHeaders?.()||{})}, body: JSON.stringify(body) });
  if(!r.ok){ alert('Error creando pedido test'); return; }
  await cargarPedidos();
  renderPedidos();
  toggleDebug(true);
});

if (debugDelTest) debugDelTest.addEventListener('click', async () => {
  // Borrar pedidos cuyo cliente empiece con 'Test '
  const testIds = pedidos.filter(p => /^Test /.test(p.cliente||'')).map(p=>p.id);
  for(const id of testIds){ await fetch(`${API_BASE}/orders/${id}`, { method:'DELETE', headers: { ...(window.getAdminAuthHeaders?.()||{}) } }); }
  await cargarPedidos();
  renderPedidos();
  toggleDebug(true);
  if(!testIds.length) alert('No había pedidos de prueba');
});

if (debugExport) debugExport.addEventListener('click', () => {
  exportPedidosCSV();
});

function exportPedidosCSV(){
  if(!pedidos.length){ alert('No hay pedidos para exportar'); return; }
  const encabezados = ['id','cliente','estado','importe','fechaCreacion'];
  const filas = pedidos.map(p => encabezados.map(k => sanitizeCSV(p[k])));
  const csv = [encabezados.join(','), ...filas.map(f=>f.join(','))].join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pedidos_'+ new Date().toISOString().replace(/[:T]/g,'-').split('.')[0] + '.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 500);
}
function sanitizeCSV(val){
  if(val === null || val === undefined) return '';
  let s = String(val);
  if(/[",\n]/.test(s)) s = '"' + s.replace(/"/g,'""') + '"';
  return s;
}

// Inicial
(async function initAdmin(){
  console.log('[INIT] Iniciando panel de administración...');
  console.log('[INIT] tbodyPedidos existe:', !!tbodyPedidos);
  console.log('[INIT] API_BASE:', API_BASE);
  
  await cargarProductosParaSelect();
  console.log('[INIT] Productos cargados');
  
  await cargarPedidos();
  console.log('[INIT] Pedidos cargados:', pedidos.length);
  
  // Prefiltrar por query param ?q=
  try {
    const q = new URLSearchParams(location.search).get('q');
    if (q && filtroPedidos) {
      filtroPedidos.value = q;
    }
  } catch {}
  
  console.log('[INIT] Llamando a renderPedidos...');
  renderPedidos();
  console.log('[INIT] Render completado');
  
  // Polling cada 10s
  setInterval(async ()=>{
    console.log('[POLLING] Actualizando pedidos...');
    const old = new Map(pedidosPreviosMap); // copia para comparar
    await cargarPedidos();
    renderPedidos();
    // (La comparación se hace dentro de renderPedidos con pedidosPreviosMap)
  }, 10000);
})();

}); // Fin DOMContentLoaded
