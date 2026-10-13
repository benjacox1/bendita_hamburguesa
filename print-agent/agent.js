import 'dotenv/config';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import iconv from 'iconv-lite';
import readline from 'readline';
import { writeFile, unlink } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import path from 'path';

const run = promisify(exec);
const { API_URL, PRINT_API_KEY, SERIAL_PORT, PRINTER_SHARE } = process.env;
const TEST_MODE = process.env.TEST_MODE === '1';
const W = Number(process.env.TICKET_WIDTH || 32);
const headers = { 'x-api-key': PRINT_API_KEY };

let pendientes = [];
let imprimiendo = false;
let arduino = null;

// ---------- Ticket ----------
const linea = (izq, der) => {
  const espacio = Math.max(1, W - izq.length - der.length);
  return izq.slice(0, W - der.length - 1) + ' '.repeat(espacio) + der + '\n';
};

function fechaTexto(o) {
  return new Date(o.fechaCreacion).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Tucuman'
  });
}

function ticketTexto(o) {
  let t = '\n' + '='.repeat(W) + '\n';
  t += '   BENDITA HAMBURGUESA\n';
  t += '-'.repeat(W) + '\n';
  t += `Pedido: #${o.id}\n`;
  t += `Fecha: ${fechaTexto(o)}\n`;
  t += `Cliente: ${o.cliente || '-'}\n`;
  t += '-'.repeat(W) + '\n';
  for (const i of o.items) {
    t += linea(`${i.cantidad}x ${i.nombre}`, `$${Number(i.subtotal).toFixed(0)}`);
  }
  t += '-'.repeat(W) + '\n';
  t += linea('TOTAL', `$${Number(o.importe).toFixed(0)}`);
  t += '='.repeat(W) + '\n';
  return t;
}

const ESC = 0x1b, GS = 0x1d;
const cmd = (...b) => Buffer.from(b);
const txt = s => iconv.encode(s, 'cp858');

function ticketEscPos(o) {
  return Buffer.concat([
    cmd(ESC, 0x40),
    cmd(ESC, 0x74, 19),
    cmd(ESC, 0x61, 1),
    cmd(GS, 0x21, 0x11),
    txt('BENDITA\nHAMBURGUESA\n'),
    cmd(GS, 0x21, 0x00),
    txt('-'.repeat(W) + '\n'),
    cmd(ESC, 0x61, 0),
    txt(`Pedido: #${o.id}\n`),
    txt(`Fecha: ${fechaTexto(o)}\n`),
    cmd(ESC, 0x45, 1),
    txt(`Cliente: ${o.cliente || '-'}\n`),
    cmd(ESC, 0x45, 0),
    txt('-'.repeat(W) + '\n'),
    ...o.items.map(i =>
      txt(linea(`${i.cantidad}x ${i.nombre}`, `$${Number(i.subtotal).toFixed(0)}`))
    ),
    txt('-'.repeat(W) + '\n'),
    cmd(ESC, 0x45, 1),
    cmd(GS, 0x21, 0x01),
    txt(linea('TOTAL', `$${Number(o.importe).toFixed(0)}`)),
    cmd(GS, 0x21, 0x00),
    cmd(ESC, 0x45, 0),
    txt('\n\n\n\n'),
    cmd(GS, 0x56, 0x42, 0x00)
  ]);
}

async function imprimirRaw(buf) {
  const tmp = path.join(os.tmpdir(), `ticket_${Date.now()}.bin`);
  await writeFile(tmp, buf);
  try {
    await run(`copy /B "${tmp}" "\\\\localhost\\${PRINTER_SHARE}"`);
  } finally {
    unlink(tmp).catch(() => {});
  }
}

// ---------- Backend ----------
async function actualizarPendientes() {
  try {
    const r = await fetch(`${API_URL}/print/pending`, { headers });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    pendientes = await r.json();
  } catch (e) {
    console.warn('[AGENTE] No se pudo consultar pendientes:', e.message);
  }
  avisarArduino();
}

async function imprimirSiguiente() {
  if (imprimiendo) return;
  if (!pendientes.length) {
    console.log('[AGENTE] Botón apretado, no hay pedidos pendientes');
    return;
  }
  imprimiendo = true;
  const o = pendientes[0];
  try {
    if (TEST_MODE) console.log(ticketTexto(o));
    else await imprimirRaw(ticketEscPos(o));

    const r = await fetch(`${API_URL}/print/${o.id}/done`, { method: 'POST', headers });
    if (!r.ok) throw new Error('No se pudo marcar impreso: HTTP ' + r.status);
    pendientes.shift();
    console.log('[AGENTE] Impreso pedido', o.id, '-', o.cliente);
  } catch (e) {
    console.error('[AGENTE] Error imprimiendo:', e.message);
  } finally {
    imprimiendo = false;
    avisarArduino();
  }
}

// ---------- Botón: Arduino o teclado ----------
let pendientesPrev = 0;
function avisarArduino() {
  if (TEST_MODE) {
    if (pendientes.length > pendientesPrev) {
      console.log(`\n[AGENTE] Hay ${pendientes.length} pedido(s) pendiente(s). Presioná ENTER para imprimir.`);
    }
    pendientesPrev = pendientes.length;
    return;
  }
  if (arduino && arduino.isOpen) arduino.write(`P:${pendientes.length}\n`);
}

if (TEST_MODE) {
  console.log('[AGENTE] MODO PRUEBA: ENTER = botón del Arduino, el ticket sale por consola.');
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', () => imprimirSiguiente());
} else {
  arduino = new SerialPort({ path: SERIAL_PORT, baudRate: 9600 });
  const parser = arduino.pipe(new ReadlineParser({ delimiter: '\n' }));
  arduino.on('open', () => console.log('[AGENTE] Arduino conectado en', SERIAL_PORT));
  arduino.on('error', e => console.error('[AGENTE] Error serie:', e.message));
  parser.on('data', l => {
    if (l.trim() === 'BTN') imprimirSiguiente();
  });
}

setInterval(actualizarPendientes, 4000);
actualizarPendientes();