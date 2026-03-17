import { Router } from 'express';
import admin from 'firebase-admin';
import { body, validationResult } from 'express-validator';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { ROLE_USAGER } from '../lib/roles.js';

export const authRouter = Router();

/**
 * Création du profil utilisateur après inscription Firebase.
 * L'utilisateur doit envoyer son Firebase ID token (Bearer).
 * Body: firstName, lastName, hospitalId (optionnel)
 * Le rôle est automatiquement 2 (usager).
 */
authRouter.post(
  '/register-profil',
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('hospitalId').optional().isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token Firebase requis' });
    }
    const token = auth.slice(7);

    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      const uid = decodedToken.uid;
      const email = decodedToken.email || req.body.email;

      if (!email) {
        return res.status(400).json({ error: 'Email requis (fourni par Firebase Auth)' });
      }

      const existing = await prisma.user.findUnique({ where: { id: uid } });
      if (existing) {
        return res.status(409).json({
          error: 'Profil déjà créé',
          user: {
            id: existing.id,
            email: existing.email,
            firstName: existing.firstName,
            lastName: existing.lastName,
            role: existing.role,
            hospitalId: existing.hospitalId,
          },
        });
      }

      const user = await prisma.user.create({
        data: {
          uid,
          email,
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          role: ROLE_USAGER,
          hospitalId: req.body.hospitalId || null,
        },
      });

      let hospital = null;
      if (user.hospitalId) {
        const h = await prisma.hospital.findUnique({ where: { id: user.hospitalId } });
        hospital = h ? { id: h.id, name: h.name } : null;
      }

      res.status(201).json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        hospitalId: user.hospitalId,
        hospital,
      });
    } catch (err) {
      if (err.code === 'auth/id-token-expired') {
        return res.status(401).json({ error: 'Session expirée. Reconnectez-vous.' });
      }
      if (err.code === 'auth/argument-error') {
        return res.status(401).json({ error: 'Token Firebase invalide' });
      }
      throw err;
    }
  }
);

/**
 * Utilisateur courant (profil Firestore).
 * Requiert Bearer token Firebase valide.
 */
authRouter.get('/me', requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    firstName: req.user.firstName,
    lastName: req.user.lastName,
    role: req.user.role,
    hospitalId: req.user.hospitalId,
    hospital: req.user.hospital ? { id: req.user.hospital.id, name: req.user.hospital.name } : null,
  });
});
