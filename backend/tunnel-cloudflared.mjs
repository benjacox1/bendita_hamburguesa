#!/usr/bin/env node
// Script: tunnel-cloudflared.mjs
// Objetivo: arrancar el backend + levantar un quick tunnel cloudflared automáticamente,
// capturar la URL pública y actualizar (o inyectar) MP_WEBHOOK en .env si no está definida
// o si apunta a otra URL de tunnel. Muestra la URL final y hace health check.

import { spawn } from 'child_process';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const BACKEND_PORT = process.env.PORT || 4000;
const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(__filename);
const envFile = path.join(projectRoot, '.env');

function ensureEnvWebhook(url){
  let content = '';
  if(fs.existsSync(envFile)) content = fs.readFileSync(envFile,'utf8');
  const lines = content.split(/\r?\n/);
  let found = false; let changed = false;
  for(let i=0;i<lines.length;i++){
    if(/^MP_WEBHOOK\s*=/.test(lines[i])){
      found = true;
      if(!lines[i].includes(url)){
        lines[i] = `MP_WEBHOOK=${url}`;
        changed = true;
      }
    }
  }
  if(!found){
    lines.push(`MP_WEBHOOK=${url}`);
    changed = true;
  }
  if(changed){
    fs.writeFileSync(envFile, lines.filter(l=>l.trim().length>0).join('\n') + '\n','utf8');
    console.log('[tunnel] .env actualizado con MP_WEBHOOK=', url);
  } else {
    console.log('[tunnel] MP_WEBHOOK ya estaba configurado con esa URL');
  }
}

function startBackend(){
  console.log('[backend] iniciando server.js en puerto', BACKEND_PORT);
  const p = spawn(process.execPath, ['--watch','server.js'], { cwd: projectRoot, stdio: 'inherit' });
  p.on('exit', code=> console.log('[backend] proceso finalizado', code));
  return p;
}

function isValidExe(file){
  try {
    if(!fs.existsSync(file)) return false;
    const stat = fs.statSync(file);
    if(stat.size < 200000) return false; // tamaño mínimo aproximado
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(2);
    fs.readSync(fd, buf, 0, 2, 0);
    fs.closeSync(fd);
    return buf.toString('ascii') === 'MZ';
  } catch { return false; }
}

function downloadCloudflared(target){
  const startUrl = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe';
  let redirects = 0;
  return new Promise((resolve, reject)=>{
    const file = fs.createWriteStream(target);
    const fetchUrl = (url)=>{
      console.log('[tunnel][auto] Descargando cloudflared desde', url);
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        protocol: urlObj.protocol,
        headers: { 'User-Agent': 'cloudflared-downloader-script' }
      };
      https.get(options, res => {
        if(res.statusCode >=300 && res.statusCode <400 && res.headers.location){
          if(++redirects>5){
            reject(new Error('Demasiadas redirecciones al descargar cloudflared'));
            return;
          }
            const next = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).toString();
            console.log('[tunnel][auto] Redirección a', next);
            res.resume();
            fetchUrl(next);
            return;
        }
        if(res.statusCode !== 200){
          reject(new Error('HTTP '+res.statusCode+' al descargar cloudflared'));
          return;
        }
        res.pipe(file);
        file.on('finish', ()=> file.close(()=>{ console.log('[tunnel][auto] Descarga completada'); resolve(); }));
      }).on('error', err => reject(err));
    };
    fetchUrl(startUrl);
  });
}

async function ensureCloudflared(){
  const exeNames = [ 'cloudflared.exe', 'cloudflared', 'cloudflared-windows-amd64.exe' ];
  const searchDirs = [
    path.normalize(path.join(projectRoot, '..')),
    projectRoot,
    path.join(projectRoot, '..', 'cloudflared')
  ];
  for(const dir of searchDirs){
    for(const name of exeNames){
      const candidate = path.join(dir, name);
      if(fs.existsSync(candidate)){
        if(isValidExe(candidate)) return candidate;
        console.warn('[tunnel][warn] Ejecutable inválido (se re-descargará):', candidate);
      }
    }
  }
  const target = path.join(path.normalize(path.join(projectRoot, '..')), 'cloudflared.exe');
  await downloadCloudflared(target);
  if(!isValidExe(target)){
    throw new Error('cloudflared descargado pero inválido (archivo corrupto). Descarga manual requerida.');
  }
  return target;
}

function healthCheck(url, attempts=15){
  return new Promise(resolve=>{
    let left = attempts;
    const tryOnce = ()=>{
      fetch(url).then(r=>r.ok ? r.json():null).then(j=>{
        if(j && j.ok){
          console.log('[health] OK backend time=', j.time);
          return resolve(true);
        }
        if(--left>0) setTimeout(tryOnce, 1000); else resolve(false);
      }).catch(()=>{ if(--left>0) setTimeout(tryOnce, 1000); else resolve(false); });
    };
    tryOnce();
  });
}

async function startTunnel(){
  const exeNames = [ 'cloudflared.exe', 'cloudflared', 'cloudflared-windows-amd64.exe' ];
  let exePath = null;
  const searchDirs = [
    path.normalize(path.join(projectRoot, '..')),              // raíz proyecto
    projectRoot,                                              // backend/
    path.join(projectRoot, '..', 'cloudflared'),              // carpeta dedicada opcional
  ];
  console.log('[tunnel][debug] Buscando ejecutable en rutas:', searchDirs.join(' | '));
  exePath = await ensureCloudflared();
  console.log('[tunnel] Ejecutable listo:', exePath);
  console.log('[tunnel] Lanzando cloudflared quick tunnel...');
  const args = ['tunnel','--url', `http://localhost:${BACKEND_PORT}`];
  const proc = spawn(exePath, args, { cwd: path.dirname(exePath) });

  const rl = readline.createInterface({ input: proc.stdout });
  const rlErr = readline.createInterface({ input: proc.stderr });

  let publicUrl = null;
  // Patrón más flexible: subdominios compuestos por letras, números y guiones
  const urlRegex = /(https:\/\/[a-z0-9-]+\.trycloudflare\.com)/i;
  let urlTimeout = setTimeout(()=>{
    if(!publicUrl){
      console.error('[tunnel] Tiempo de espera agotado. No se detectó URL en 25s. Revisa tu conexión o versión de cloudflared.');
    }
  }, 25000);

  function detect(line){
    if(publicUrl) return;
    let m = line.match(urlRegex);
    if(!m && line.includes('trycloudflare.com')){
      // Fallback: extraer primera coincidencia básica
      const mt = line.match(/https:\/\/[^\s]+trycloudflare\.com/);
      if(mt) m = [mt[0], mt[0]];
    }
    if(m && !publicUrl){
      publicUrl = m[1];
      clearTimeout(urlTimeout);
      console.log('\n[tunnel] URL pública detectada:', publicUrl);
      const webhook = publicUrl + '/webhooks/mercadopago';
      ensureEnvWebhook(webhook);
      console.log('[tunnel] Webhook listo =>', webhook);
      console.log('[tunnel] Test rápido (PowerShell):');
      console.log('         $b = @{ external_reference = "ref_TEST"; status = "approved" } | ConvertTo-Json');
      console.log('         Invoke-RestMethod -Method Post -Uri', webhook, '-ContentType application/json -Body $b');
    }
  }

  rl.on('line', line => { console.log('[cloudflared]', line); detect(line); });
  rlErr.on('line', line => { console.error('[cloudflared:err]', line); detect(line); });

  proc.on('exit', code => { console.log('[tunnel] cloudflared finalizó con código', code); if(!publicUrl) console.error('[tunnel] No se obtuvo URL pública.'); process.exit(code||0); });
  return proc;
}

async function main(){
  startBackend();
  const ok = await healthCheck(`http://localhost:${BACKEND_PORT}/api/health`);
  if(!ok) console.warn('[health] Backend no respondió a tiempo, se intentará igual el túnel.');
  await startTunnel();
}

main().catch(e=>{ console.error('[main] Error', e); process.exit(1); });
