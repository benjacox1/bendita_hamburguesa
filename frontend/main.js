// Carga y render del catálogo en la página principal

const GRID = document.getElementById('listado');
const ESTADO = document.getElementById('estado');
const BUSCADOR = document.getElementById('buscador');
const CATEGORIA = document.getElementById('categoria');
const ORDEN = document.getElementById('orden');
const LIMPIAR = document.getElementById('limpiar');
const REFRESCAR = document.getElementById('refrescar');
const YEAR = document.getElementById('year');
YEAR.textContent = new Date().getFullYear();
const LS_CARRITO = 'carrito_items_v1';

function leerCarrito(){
  try { return JSON.parse(localStorage.getItem(LS_CARRITO)) || []; } catch { return []; }
}
function actualizarCartCount(){
  const el = document.getElementById('cart-count');
  const fab = document.getElementById('cart-fab');
  const fabCount = document.getElementById('cart-count-fab');
  if(!el) return;
  const items = leerCarrito();
  const total = items.reduce((acc,i)=> acc + (Number(i.cantidad)||0), 0);
  el.textContent = total;
  if(fabCount) fabCount.textContent = total;
  if(fab) fab.classList.toggle('show', total > 0);
}

function renderMiniCart(){
  const panel = document.getElementById('cart-mini');
  if(!panel) return;
  const items = leerCarrito();
  const total = items.reduce((acc,i)=> acc + (Number(i.precio)*Number(i.cantidad)||0), 0);
  const backend = (window.APP_CONFIG?.BACKEND || 'http://localhost:4000');
  const backendOk = !window.APP_CONFIG?.BACKEND_UNAVAILABLE;
  const rows = items.slice(0,6).map(i=> {
    const imgPath = (i.imagen||'').replace(/^\/*/, '');
    const parts = imgPath.split('/');
    const fileName = parts[parts.length-1];
    const v = (window.APP_CONFIG?.ASSET_VERSION ?? 1);
    const thumb = backendOk ? (backend + '/imagenes/' + encodeURIComponent(fileName) + '?v=' + v)
                            : ('detalle-productos/IMAGENES COMIDA/' + encodeURIComponent(fileName) + '?v=' + v);
    return `
    <div class="item">
      <img src="${thumb}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;border:1px solid #29313b" alt="${i.nombre}">
      <div>
        <div class="name">${i.nombre}</div>
        <div class="meta">${i.cantidad} × $ ${Number(i.precio).toFixed(2)}</div>
      </div>
    </div>`;
  }).join('');
  panel.innerHTML = `
    <header>
      <strong>Tu carrito</strong>
      <button id="mini-close">✕</button>
    </header>
    <div class="items">${rows || '<div class="item"><div class="name">Carrito vacío</div></div>'}</div>
    <div class="footer">
      <span>Total: $ ${total.toFixed(2)}</span>
      <a class="go" href="Carrito de compras/carrito.html">Ir al carrito</a>
    </div>
  `;
  panel.querySelector('#mini-close')?.addEventListener('click', ()=> toggleMiniCart(false));
}

function toggleMiniCart(force){
  const panel = document.getElementById('cart-mini');
  if(!panel) return;
  const show = force !== undefined ? force : !panel.classList.contains('show');
  if(show){ renderMiniCart(); panel.classList.add('show'); }
  else { panel.classList.remove('show'); }
}

let productos = [];
let filtrado = [];
let PLACEHOLDERS = {};

async function cargarPlaceholders(){
  try {
    const r = await fetch('detalle-productos/IMAGENES COMIDA/placeholders.json?_=' + Date.now());
    if(r.ok){ PLACEHOLDERS = await r.json(); }
  } catch(e){ console.warn('[PLACEHOLDERS] no disponibles (local):', e.message); }
}

async function cargarProductos(){
  ESTADO.style.display='block';
  ESTADO.textContent='Cargando productos...';
  const backendURL = (window.APP_CONFIG?.API_BASE || 'http://localhost:4000/api') + '/products';
  try {
    let resp = await fetch(backendURL, { cache:'no-store' });
    if(!resp.ok) throw new Error('Backend HTTP '+resp.status);
    productos = await resp.json();
  } catch (e) {
    console.warn('[CATALOGO] Backend no disponible, intento fallback local:', e.message);
    try {
  const respLocal = await fetch('detalle-productos/productos.json?_=' + Date.now());
      if(!respLocal.ok) throw new Error('Archivo local HTTP '+respLocal.status);
      productos = await respLocal.json();
      ESTADO.innerHTML = '<small>Modo fallback (archivo local). Inicia el backend para stock dinámico.</small>';
    } catch(err2){
      console.error('[CATALOGO] Error cargando fallback:', err2);
      ESTADO.innerHTML = `No se pudieron cargar los productos.<br><small>${err2.message}</small><br><small>Asegúrate de ejecutar el backend (npm run dev) o servir por http:// y no file://</small>`;
      return;
    }
  }
  construirCategorias();
  aplicarFiltros();
}

function construirCategorias(){
  // limpiar previos (por recargas repetidas)
  [...CATEGORIA.querySelectorAll('option')].forEach((o,i)=>{ if(i>0) o.remove(); });
  const cats = [...new Set(productos.map(p=>p.categoria))].sort();
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c.charAt(0).toUpperCase()+c.slice(1);
    CATEGORIA.appendChild(opt);
  });
}

function aplicarFiltros(){
  const q = BUSCADOR.value.trim().toLowerCase();
  const cat = CATEGORIA.value;
  filtrado = productos.filter(p=> {
    const coincideTexto = !q || p.nombre.toLowerCase().includes(q);
    const coincideCat = !cat || p.categoria === cat;
    return coincideTexto && coincideCat;
  });
  ordenar();
  render();
  actualizarCartCount();
}

function ordenar(){
  const val = ORDEN.value;
  if(!val) return;
  if(val === 'precio-asc') filtrado.sort((a,b)=>a.precio-b.precio);
  if(val === 'precio-desc') filtrado.sort((a,b)=>b.precio-a.precio);
  if(val === 'nombre-asc') filtrado.sort((a,b)=>a.nombre.localeCompare(b.nombre));
  if(val === 'nombre-desc') filtrado.sort((a,b)=>b.nombre.localeCompare(a.nombre));
}

function formatearPrecio(p){ return '$ '+Number(p).toFixed(2); }

function render(){
  GRID.innerHTML = '';
  if(!filtrado.length){
    GRID.innerHTML = '<div class="empty">No hay productos para mostrar.</div>';
  }
  const tpl = document.getElementById('tpl-card');
  filtrado.forEach(p => {
    const node = tpl.content.cloneNode(true);
    const img = node.querySelector('.card-img');
    // Construir imagen: si backend está disponible, usar /imagenes; si no, usar carpeta local
    const imgPath = (p.imagen || '').replace(/^\/*/,'');
    const parts = imgPath.split('/');
    const fileName = parts[parts.length-1];
    const v = (window.APP_CONFIG?.ASSET_VERSION ?? 1);
    const backend = (window.APP_CONFIG?.BACKEND || 'http://localhost:4000');
    const backendOk = !window.APP_CONFIG?.BACKEND_UNAVAILABLE;
    const finalSrc = backendOk
      ? (backend + '/imagenes/' + encodeURIComponent(fileName) + '?v=' + v)
      : ('detalle-productos/IMAGENES COMIDA/' + encodeURIComponent(fileName) + '?v=' + v);
    const placeholder = PLACEHOLDERS[fileName];
    img.loading = 'lazy';
    img.classList.add('blur-up');
    if(placeholder){
      // usar placeholder como background mientras carga
      img.style.backgroundImage = `url(${placeholder})`;
      img.style.backgroundSize = 'cover';
      img.style.backgroundPosition = 'center';
    }
    img.src = finalSrc;
    img.addEventListener('load', ()=>{
      img.classList.add('is-loaded');
      // limpiar background para liberar memoria
      setTimeout(()=>{ img.style.backgroundImage=''; }, 400);
    }, { once: true });
    img.alt = p.nombre;
    node.querySelector('.badge-cat').textContent = p.categoria;
    node.querySelector('.card-title').textContent = p.nombre;
    node.querySelector('.precio').textContent = formatearPrecio(p.precio);
    // construir href seguro evitando problemas con espacios en carpeta
  const baseDetalle = 'detalle-productos/producto.html';
  node.querySelector('.btn-ver').setAttribute('href', baseDetalle + '?id=' + encodeURIComponent(p.id));
    // hacer que toda la card sea clickeable
    const art = node.querySelector('.card');
    art.dataset.id = p.id;
    GRID.appendChild(node);
  });
  ESTADO.style.display='none';
}

BUSCADOR.addEventListener('input', aplicarFiltros);
CATEGORIA.addEventListener('change', aplicarFiltros);
ORDEN.addEventListener('change', aplicarFiltros);
LIMPIAR.addEventListener('click', ()=>{
  BUSCADOR.value=''; CATEGORIA.value=''; ORDEN.value=''; aplicarFiltros();
});

if(REFRESCAR){
  REFRESCAR.addEventListener('click', async ()=>{
    await cargarProductos();
  });
}

document.getElementById('btn-scroll-productos').addEventListener('click', e => {
  e.preventDefault();
  document.getElementById('listado').scrollIntoView({behavior:'smooth'});
});

  Promise.all([cargarPlaceholders(), cargarProductos()]);

// Toggle mini cart from header and FAB
document.getElementById('btn-cart')?.addEventListener('click', (e)=>{ e.preventDefault(); toggleMiniCart(); });
document.getElementById('cart-fab')?.addEventListener('click', (e)=>{ /* allow normal navigation if wanted */ e.preventDefault(); toggleMiniCart(true); });

// Close mini on outside click / ESC
document.addEventListener('click', (e)=>{
  const mini = document.getElementById('cart-mini');
  if(!mini || !mini.classList.contains('show')) return;
  const isInside = mini.contains(e.target) || e.target.closest('#btn-cart') || e.target.closest('#cart-fab');
  if(!isInside) toggleMiniCart(false);
});
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') toggleMiniCart(false); });

// ================= Animaciones & Dinamismo =================
// IntersectionObserver para revelar elementos con clase .reveal
const observer = new IntersectionObserver((entries)=>{
  entries.forEach(ent=>{
    if(ent.isIntersecting){
      ent.target.classList.add('is-visible');
      observer.unobserve(ent.target);
    }
  });
},{rootMargin:'0px 0px -10% 0px',threshold:0.15});

function observarReveals(){
  document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
}

// Re-observar tras render dinámico de productos
const _renderOriginal = render;
render = function(){
  _renderOriginal();
  // aplicar reveal a nuevas cards
  requestAnimationFrame(()=>observarReveals());
  actualizarCartCount();
};

// Parallax sutil del hero según scroll
const heroInner = document.querySelector('.hero-inner');
if(heroInner){
  window.addEventListener('scroll',()=>{
    const y = window.scrollY || document.documentElement.scrollTop;
    // limitar translate para no exagerar
    const t = Math.min(y * 0.08, 40);
    heroInner.style.transform = `translateY(${t}px)`;
  }, {passive:true});
}

// Iniciar observer inicial
observarReveals();

// ================= Manejo Global de Errores =================
window.addEventListener('error', (e)=>{
  console.error('[GLOBAL ERROR]', e.message);
});
window.addEventListener('unhandledrejection', (e)=>{
  console.error('[PROMISE REJECTION]', e.reason);
});

// Delegación de click para asegurar navegación a detalle aunque alguna animación afecte
GRID.addEventListener('click', (e)=>{
  const card = e.target.closest('.card');
  if(card && card.dataset.id){
    const url = 'detalle-productos/producto.html?id=' + encodeURIComponent(card.dataset.id);
    window.location.href = url;
    return;
  }
  const link = e.target.closest('.btn-ver');
  if(link){
    const url = link.getAttribute('href');
    if(url){ window.location.href = url; }
  }
});

// Sincronizar contador en cambios de storage (otras pestañas)
window.addEventListener('storage', (e)=>{ if(e.key === LS_CARRITO) actualizarCartCount(); });
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) actualizarCartCount(); });

// Auto-actualizar catálogo cuando el admin lo modifique en otra pestaña
window.addEventListener('storage', async (e)=>{
  if(e.key === 'catalog_updated_v1'){
    await cargarProductos();
  }
});

// Mostrar resultado de pago si vuelve con ?pago=success|failure|pending
(function(){
  const params = new URLSearchParams(location.search);
  const pago = params.get('pago');
  if(!pago) return;
  const toast = document.createElement('div');
  toast.className = 'toast-pago';
  const map = { success: 'Pago aprobado', failure: 'Pago fallido o cancelado', pending: 'Pago pendiente' };
  toast.textContent = map[pago] || 'Estado de pago: ' + pago;
  toast.dataset.estado = pago;
  document.body.appendChild(toast);
  setTimeout(()=> toast.classList.add('visible'),50);
  setTimeout(()=> { toast.classList.remove('visible'); setTimeout(()=>toast.remove(),600); }, 6000);
})();

// ====== Estado detallado del último pedido (post pago) ======
(async function(){
  try {
    const raw = sessionStorage.getItem('last_order_info_v1');
    if(!raw) return;
    const info = JSON.parse(raw);
    // Sólo consultamos si la URL trae ?pago= para evitar consultas innecesarias en visitas limpias
    const params = new URLSearchParams(location.search);
    if(!params.get('pago')) return;
    const orderId = info.orderId;
    if(!orderId) return;
    const apiBase = (window.APP_CONFIG?.API_BASE) || 'http://localhost:4000/api';
    const r = await fetch(apiBase + '/orders/' + encodeURIComponent(orderId), { cache:'no-store' });
    if(!r.ok) throw new Error('No se pudo obtener pedido');
    const pedido = await r.json();
    // Crear panel flotante con detalle
    const panel = document.createElement('div');
    panel.style.position='fixed';
    panel.style.bottom='1rem';
    panel.style.right='1rem';
    panel.style.zIndex='9999';
    panel.style.background='#111c';
    panel.style.backdropFilter='blur(6px)';
    panel.style.padding='12px 16px';
    panel.style.border='1px solid #444';
    panel.style.borderRadius='8px';
    panel.style.fontSize='13px';
    panel.style.color='#fff';
    const payColor = pedido.paymentStatus === 'approved' ? '#2ecc71' : (pedido.paymentStatus === 'rejected' ? '#e74c3c' : '#f1c40f');
    panel.innerHTML = `<strong>Pedido ${pedido.id}</strong><br>
      Estado preparación: <span style="color:#ccc">${pedido.estado}</span><br>
      Pago: <strong style="color:${payColor}">${pedido.paymentStatus||'pending'}</strong><br>
      Importe: $ ${pedido.importe?.toFixed(2) || '0.00'}<br>
      <button id="panel-close" style="margin-top:6px;background:#333;color:#fff;padding:4px 10px;border-radius:4px;border:1px solid #555;cursor:pointer">Cerrar</button>`;
    document.body.appendChild(panel);
    panel.querySelector('#panel-close').addEventListener('click', ()=> panel.remove());
    // Si pago aprobado, limpiar carrito local y la info almacenada
    if(pedido.paymentStatus === 'approved'){
      try { localStorage.removeItem('carrito_items_v1'); } catch{}
      try { sessionStorage.removeItem('last_order_info_v1'); } catch{}
    }
  } catch(e){ console.warn('[POST-PAGO]', e.message); }
})();
