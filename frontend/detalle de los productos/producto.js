// Vista de detalle de producto -> ahora solo agrega al carrito (no crea pedido inmediato)
// Carga producto desde backend (o fallback) y permite añadir cantidad al carrito en localStorage.

const BACKEND = (window.APP_CONFIG?.BACKEND) || 'http://localhost:4000';
let modoFallback = false;

const LS_CARRITO = 'carrito_items_v1';

function apiBase(){ return (window.APP_CONFIG?.API_BASE) || (BACKEND + '/api'); }

function getParamId(){
  const u = new URL(location.href);
  return u.searchParams.get('id');
}
function formatearPrecio(p){ return '$ ' + Number(p).toFixed(2); }

async function fetchProductos(){
  try {
    const url = apiBase() + '/products';
    const r = await fetch(url, { cache:'no-store' });
    if(!r.ok) throw new Error('HTTP '+r.status+' al solicitar '+url);
    return await r.json();
  } catch(e){
    console.warn('[DETALLE] Backend no disponible, fallback a productos.json:', e.message);
    modoFallback = true;
    const rLocal = await fetch('productos.json?_=' + Date.now());
    if(!rLocal.ok) throw new Error('No se pudo cargar productos.json');
    return rLocal.json();
  }
}

// ==== Carrito helpers ====
function leerCarrito(){
  try { return JSON.parse(localStorage.getItem(LS_CARRITO)) || []; } catch { return []; }
}
function guardarCarrito(arr){
  localStorage.setItem(LS_CARRITO, JSON.stringify(arr));
}
function agregarAlCarrito(producto, cantidad){
  const lista = leerCarrito();
  const idx = lista.findIndex(i => i.id === producto.id);
  if(idx !== -1){
    lista[idx].cantidad += cantidad;
  } else {
    lista.push({ id: producto.id, nombre: producto.nombre, precio: producto.precio, cantidad, imagen: producto.imagen });
  }
  guardarCarrito(lista);
  return lista;
}

async function init(){
  const cont = document.getElementById('contenedor');
  const estado = document.getElementById('estado-carga');
  const id = getParamId();
  if(!id){ estado.textContent = 'Falta el parámetro ?id='; return; }
  try {
    const productos = await fetchProductos();
    const prod = productos.find(p=>p.id === id);
    if(!prod){ estado.textContent = 'Producto no encontrado.'; return; }

    estado.remove();
    const tpl = document.getElementById('tpl-producto');
    const node = tpl.content.cloneNode(true);

    node.getElementById('prod-imagen').src = prod.imagen || '';
    node.getElementById('prod-imagen').alt = prod.nombre;
    node.getElementById('prod-nombre').textContent = prod.nombre;
    node.getElementById('prod-descripcion').textContent = prod.descripcion || '';
    node.getElementById('prod-precio').textContent = formatearPrecio(prod.precio);
    node.getElementById('prod-categoria').textContent = prod.categoria;
    document.getElementById('titulo-prod').textContent = prod.nombre + (modoFallback? ' (solo lectura)' : '');

    cont.appendChild(node);

    const form = document.getElementById('form-agregar');
    const resultado = document.getElementById('resultado');
    const linkCarrito = document.getElementById('link-carrito');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const datos = Object.fromEntries(new FormData(form).entries());
      const cantidad = parseInt(datos.cantidad || '1');
      if(cantidad <= 0){
        resultado.textContent = 'Cantidad inválida';
        resultado.classList.add('error');
        return;
      }
      resultado.classList.remove('error');
      agregarAlCarrito(prod, cantidad);
      resultado.textContent = 'Agregado al carrito ('+cantidad+')';
      linkCarrito.style.display = 'inline-block';
      form.reset();
    });
  } catch(err){
    estado.textContent = 'Error cargando datos: ' + err.message;
  }
}

init();
