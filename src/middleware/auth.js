import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from '../db.js';

/**
 * Vérifie le JWT et attache l'utilisateur à req.user.
 * N'envoie pas 401 si token absent (pour routes optionnellement protégées).
 */
export function optionalAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return next();
  const token = auth.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.userId = decoded.userId;
    return next();
  } catch {
    return next();
  }
}

/**
 * Authentification requise. 401 si pas de token ou token invalide.
 */
export async function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  const token = auth.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.userId = decoded.userId;
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { hospital: true },
    });
    if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' });
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

/**
 * Restreint l'accès aux rôles supervisor et admin.
 */
export function requireSupervisor(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
  if (req.user.role !== 'supervisor' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Droits superviseur requis' });
  }
  next();
}

/**
 * Vérifie que l'utilisateur appartient au même hôpital que la ressource (hospitalId).
 */
export function sameHospital(hospitalIdKey = 'hospitalId') {
  return (req, res, next) => {
    const id = req.params[hospitalIdKey] || req.body[hospitalIdKey] || req.query[hospitalIdKey];
    if (!id) return next();
    if (req.user.hospitalId !== id) {
      return res.status(403).json({ error: 'Accès à un autre établissement non autorisé' });
    }
    next();
  };
}
