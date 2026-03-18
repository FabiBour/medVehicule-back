import { Router } from 'express';
import admin from 'firebase-admin';
import { body, validationResult } from 'express-validator';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { ROLE_USAGER } from '../lib/roles.js';

export const authRouter = Router();

const FIREBASE_AUTH_URL = 'https://identitytoolkit.googleapis.com/v1/accounts';
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY;

/**
 * Connexion avec email et mot de passe.
 * Retourne l'idToken Firebase pour les requêtes authentifiées.
 */
authRouter.post(
  '/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const apiKey = (process.env.FIREBASE_WEB_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(503).json({ error: 'FIREBASE_WEB_API_KEY non configuré' });
    }
    if (!apiKey.startsWith('AIza')) {
      return res.status(503).json({
        error: 'FIREBASE_WEB_API_KEY invalide : utilisez la clé API Web (format AIzaSy...), pas le private_key_id. Firebase Console > Paramètres du projet > Général > Clés API Web.',
      });
    }

    try {
      const resFirebase = await fetch(
        `${FIREBASE_AUTH_URL}:signInWithPassword?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: req.body.email,
            password: req.body.password,
            returnSecureToken: true,
          }),
        }
      );
      const data = await resFirebase.json();

      if (!resFirebase.ok) {
        const msg = data.error?.message || 'Identifiants invalides';
        if (msg.includes('INVALID_LOGIN') || msg.includes('EMAIL_NOT_FOUND') || msg.includes('INVALID_PASSWORD')) {
          return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }
        return res.status(400).json({ error: msg });
      }

      res.json({
        idToken: data.idToken,
        refreshToken: data.refreshToken,
        expiresIn: data.expiresIn,
        localId: data.localId,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur lors de la connexion' });
    }
  }
);

/**
 * Création de compte avec email et mot de passe.
 * Crée l'utilisateur dans Firebase Auth et le profil dans Firestore.
 * Retourne l'idToken pour connexion immédiate.
 */
authRouter.post(
  '/register',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('hospitalId').optional().isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, firstName, lastName, hospitalId } = req.body;

    try {
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: `${firstName} ${lastName}`,
      });
      const uid = userRecord.uid;

      const existing = await prisma.user.findUnique({ where: { id: uid } });
      if (existing) {
        return res.status(409).json({ error: 'Compte déjà existant', user: existing });
      }

      const user = await prisma.user.create({
        data: {
          uid,
          email,
          firstName,
          lastName,
          role: ROLE_USAGER,
          hospitalId: hospitalId || null,
        },
      });

      let hospital = null;
      if (user.hospitalId) {
        const h = await prisma.hospital.findUnique({ where: { id: user.hospitalId } });
        hospital = h ? { id: h.id, name: h.name } : null;
      }

      const apiKey = (process.env.FIREBASE_WEB_API_KEY || '').trim();
      if (!apiKey || !apiKey.startsWith('AIza')) {
        return res.status(201).json({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          hospitalId: user.hospitalId,
          hospital,
          message: 'Compte créé. Appelez POST /api/auth/login pour obtenir le token.',
        });
      }

      const resFirebase = await fetch(
        `${FIREBASE_AUTH_URL}:signInWithPassword?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, returnSecureToken: true }),
        }
      );
      const data = await resFirebase.json();

      if (!resFirebase.ok) {
        return res.status(201).json({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          hospitalId: user.hospitalId,
          hospital,
          message: 'Compte créé. Appelez POST /api/auth/login pour obtenir le token.',
        });
      }

      res.status(201).json({
        idToken: data.idToken,
        refreshToken: data.refreshToken,
        expiresIn: data.expiresIn,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          hospitalId: user.hospitalId,
          hospital,
        },
      });
    } catch (err) {
      if (err.code === 'auth/email-already-exists') {
        return res.status(409).json({ error: 'Cet email est déjà utilisé' });
      }
      if (err.code === 'auth/invalid-email') {
        return res.status(400).json({ error: 'Email invalide' });
      }
      if (err.code === 'auth/weak-password') {
        return res.status(400).json({ error: 'Mot de passe trop faible (min. 6 caractères)' });
      }
      console.error(err);
      res.status(500).json({ error: 'Erreur lors de la création du compte' });
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
