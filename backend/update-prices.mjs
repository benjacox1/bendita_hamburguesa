#!/usr/bin/env node
// Actualiza precios en:
// - backend/data/products.json
// - InicioInterfaz/detalle-productos/productos.json (si existe)
// - InicioInterfaz/detalle de los productos/productos.json (si existe)
// Uso:
//   node update-prices.mjs --type percent --value 10 --round nearest100 [--dry-run]
//   node update-prices.mjs --type add --value 500 --round nearest10
//   node update-prices.mjs --type set --value 3000

import fs from 'fs';
import path from 'path';

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { type: 'percent', value: 0, round: 'none', dryRun: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--type') out.type = args[++i];
    else if (a === '--value') out.value = Number(args[++i]);
    else if (a === '--round') out.round = args[++i];
    else if (a === '--dry-run') out.dryRun = true;
  }
  if (!['percent', 'add', 'set'].includes(out.type)) throw new Error('type debe ser percent|add|set');
  if (!Number.isFinite(out.value)) throw new Error('value debe ser número');
  return out;
}

function rounder(mode, n) {
  switch (mode) {
    case 'nearest10': return Math.round(n / 10) * 10;
    case 'nearest100': return Math.round(n / 100) * 100;
    case 'ceil10': return Math.ceil(n / 10) * 10;
    case 'ceil100': return Math.ceil(n / 100) * 100;
    case 'floor10': return Math.floor(n / 10) * 10;
    case 'floor100': return Math.floor(n / 100) * 100;
    case 'none':
    default: return Math.round(n);
  }
}

function computeNewPrice(type, value, roundMode, oldPrice) {
  let p = Number(oldPrice) || 0;
  if (type === 'percent') p = p * (1 + value / 100);
  else if (type === 'add') p = p + value;
  else if (type === 'set') p = value;
  p = Math.max(0, p);
  return rounder(roundMode, p);
}

function loadJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveBackup(file) {
  const dir = path.dirname(file);
  const base = path.basename(file);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const bak = path.join(dir, base + '.' + ts + '.bak');
  fs.copyFileSync(file, bak);
  return bak;
}

function updateFile(file, opts, report) {
  if (!fs.existsSync(file)) return false;
  const data = loadJSON(file);
  if (!Array.isArray(data)) throw new Error('El archivo no es un array de productos: ' + file);
  let changed = 0;
  const preview = [];
  for (const p of data) {
    const before = Number(p.precio) || 0;
    const after = computeNewPrice(opts.type, opts.value, opts.round, before);
    if (after !== before) {
      changed++;
      preview.push({ id: p.id, nombre: p.nombre, before, after });
      p.precio = after;
    }
  }
  if (opts.dryRun) {
    report.push({ file, changed, preview });
    return true;
  }
  const bak = saveBackup(file);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  report.push({ file, changed, backup: bak });
  return true;
}

async function main() {
  const opts = parseArgs();
  const root = path.resolve(path.join(path.dirname(new URL(import.meta.url).pathname), '..'));
  const targets = [
    path.join(root, 'backend', 'data', 'products.json'),
    path.join(root, 'InicioInterfaz', 'detalle-productos', 'productos.json'),
    path.join(root, 'InicioInterfaz', 'detalle de los productos', 'productos.json'),
  ];

  // Normalizar rutas en Windows (URL pathname puede iniciar con /D:)
  for (let i = 0; i < targets.length; i++) {
    targets[i] = path.normalize(targets[i].replace(/^\//, ''));
  }

  const report = [];
  let any = false;
  for (const f of targets) {
    try {
      const ok = updateFile(f, opts, report);
      any = any || ok;
    } catch (e) {
      report.push({ file: f, error: e.message });
    }
  }

  const summary = {
    options: opts,
    when: new Date().toISOString(),
    results: report,
  };

  const logsDir = path.join(root, 'backend', 'logs');
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  const outFile = path.join(logsDir, 'prices-update-' + Date.now() + '.json');
  fs.writeFileSync(outFile, JSON.stringify(summary, null, 2), 'utf8');

  const totalChanges = report.reduce((acc, r) => acc + (r.changed || 0), 0);
  console.log('[prices] Tipo=%s Valor=%s Redondeo=%s DryRun=%s', opts.type, opts.value, opts.round, opts.dryRun);
  console.log('[prices] Archivos procesados:', targets.length, 'Cambios totales:', totalChanges);
  for (const r of report) {
    if (r.error) {
      console.log('  -', r.file, 'ERROR:', r.error);
    } else {
      console.log('  -', r.file, 'cambios:', r.changed, opts.dryRun ? '(preview)' : 'backup -> ' + r.backup);
      if (opts.dryRun) {
        for (const row of r.preview.slice(0, 5)) {
          console.log('      *', row.id, ':', row.before, '->', row.after);
        }
        if (r.preview.length > 5) console.log('      ...', (r.preview.length - 5), 'más');
      }
    }
  }
  console.log('[prices] Reporte:', outFile);
  if (!any) {
    console.log('[prices] No se encontraron archivos para actualizar.');
    process.exit(2);
  }
}

main().catch(e => { console.error('[prices] Error:', e); process.exit(1); });
