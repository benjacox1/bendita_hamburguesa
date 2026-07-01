import jwt from 'jsonwebtoken';
import { promisify } from 'util';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "cambiame-por-algo-muy-secreto";
const JWT_EXPIRATION = "4h";  // Cambia según política

export async function hashPassword(password) {
  const saltRounds = 12;  // costo seguro
  return await bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
}

export async function verifyToken(token) {
  return await promisify(jwt.verify)(token, JWT_SECRET);
}

// Middleware para extraer token y validar
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Token de autorización requerido' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token inválido' });

  verifyToken(token)
    .then(payload => {
      req.user = payload;
      next();
    })
    .catch(() => res.status(403).json({ error: 'Token inválido o expirado' }));
}

// Middleware para validar admin
export function authorizeAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Acceso no autorizado' });
  next();
}
