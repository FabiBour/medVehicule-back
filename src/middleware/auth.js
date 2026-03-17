import admin from 'firebase-admin';
import { prisma } from '../db.js';

/**
 * Vérifie le Firebase ID token (Bearer) et attache l'utilisateur Firestore à req.user.
 * L'utilisateur doit être connecté via Firebase Auth ; le token est le JWT Firebase.
 */
export async function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  const token = auth.slice(7);
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;
    const user = await prisma.user.findUnique({
      where: { id: uid },
      include: { hospital: true },
    });
    if (!user) {
      return res.status(401).json({
        error: 'Profil utilisateur introuvable. Appelez POST /api/auth/register-profil pour créer votre profil.',
      });
    }
    req.userId = uid;
    req.user = user;
    return next();
  } catch (err) {
    if (err.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Session expirée. Reconnectez-vous.' });
    }
    if (err.code === 'auth/argument-error' || err.code === 'auth/id-token-revoked') {
      return res.status(401).json({ error: 'Token invalide' });
    }
    return res.status(401).json({ error: 'Authentification Firebase invalide' });
  }
}

/**
 * Auth optionnelle : n'envoie pas 401 si token absent.
 */
export async function optionalAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return next();
  const token = auth.slice(7);
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;
    const user = await prisma.user.findUnique({
      where: { id: uid },
      include: { hospital: true },
    });
    if (user) {
      req.userId = uid;
      req.user = user;
    }
  } catch {
    // ignore
  }
  return next();
}

/**
 * Restreint l'accès aux rôles gestionnaire (1) et admin (0).
 */
export function requireGestionnaire(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
  if (req.user.role !== 0 && req.user.role !== 1) {
    return res.status(403).json({ error: 'Droits gestionnaire requis' });
  }
  next();
}

/** Alias pour compatibilité */
export const requireSupervisor = requireGestionnaire;

/**
 * Restreint l'accès aux admins uniquement (role 0).
 */
export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
  if (req.user.role !== 0) {
    return res.status(403).json({ error: 'Droits administrateur requis' });
  }
  next();
}

/**
 * Vérifie que l'utilisateur appartient au même hôpital que la ressource.
 */
export function sameHospital(hospitalIdKey = 'hospitalId') {
  return (req, res, next) => {
    const id = req.params[hospitalIdKey] || req.body[hospitalIdKey] || req.query[hospitalIdKey];
    if (!id) return next();
    if (req.user.role === 0) return next(); // admin bypass
    if (req.user.hospitalId !== id) {
      return res.status(403).json({ error: 'Accès à un autre établissement non autorisé' });
    }
    next();
  };
}
