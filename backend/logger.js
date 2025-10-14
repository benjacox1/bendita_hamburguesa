import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, 'logs');

async function ensureDir() {
  try { await fs.mkdir(LOG_DIR, { recursive: true }); } catch {}
}

function ts(){
  return new Date().toISOString();
}

async function append(file, line){
  await ensureDir();
  await fs.appendFile(path.join(LOG_DIR, file), line + '\n', 'utf8');
}

export async function logApp(event, data){
  const line = `[${ts()}] ${event}` + (data? ' ' + safeJSON(data): '');
  await append('app.log', line);
}

export async function logWebhook(event, data){
  const line = `[${ts()}] ${event}` + (data? ' ' + safeJSON(data): '');
  await append('webhooks.log', line);
}

function safeJSON(obj){
  try { return JSON.stringify(obj); } catch { return '[unserializable]'; }
}

export default { logApp, logWebhook };
