import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.resolve(process.cwd(), 'bendita_hamburguesa.db');
const db = new sqlite3.Database(DB_PATH);

function run(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

export async function migrate() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      is_approved INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const adminAccounts = [
    { username: (process.env.ADMIN_USERNAME || 'benja1906').trim().toLowerCase(), password: process.env.ADMIN_PASSWORD || '1595' },
    { username: (process.env.ADMIN_USERNAME_ALT || 'admin').trim().toLowerCase(), password: process.env.ADMIN_PASSWORD_ALT || 'admin123' }
  ];

  for (const account of adminAccounts) {
    const hash = await bcrypt.hash(account.password, 10);
    await run(
      `INSERT OR IGNORE INTO users (username, password_hash, is_admin, is_approved) VALUES (?, ?, 1, 1)`,
      [account.username, hash]
    );
  }

  return { dbPath: DB_PATH };
}

export async function createPendingUser(username, password) {
  const normalized = (username || '').trim().toLowerCase();
  if (!normalized || !password) throw new Error('Usuario y contraseña son obligatorios');
  const hash = await bcrypt.hash(password, 10);
  const result = await run(
    `INSERT INTO users (username, password_hash, is_admin, is_approved) VALUES (?, ?, 0, 0)`,
    [normalized, hash]
  );
  return { id: result.lastID, username: normalized, is_admin: 0, is_approved: 0 };
}

export async function findUserByUsername(username) {
  const normalized = (username || '').trim().toLowerCase();
  if (!normalized) return null;
  return get(`SELECT * FROM users WHERE username = ?`, [normalized]);
}

export async function findUserById(id) {
  return get(`SELECT * FROM users WHERE id = ?`, [id]);
}

export async function verifyUserPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export async function listUsers() {
  return all(`SELECT * FROM users ORDER BY is_approved ASC, id ASC`);
}

export async function approveUser(id) {
  await run(`UPDATE users SET is_approved = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
  return findUserById(id);
}

export async function rejectUser(id) {
  await run(`UPDATE users SET is_approved = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
  return findUserById(id);
}
