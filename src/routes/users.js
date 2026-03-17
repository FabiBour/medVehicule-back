import { Router } from 'express';
import admin from 'firebase-admin';
import { body, param, validationResult } from 'express-validator';
import { prisma } from '../db.js';
import { requireAuth, requireAdmin, requireGestionnaire } from '../middleware/auth.js';
import { ROLE_ADMIN } from '../lib/roles.js';

export const usersRouter = Router();

/** Liste des utilisateurs (établissement ou tous si admin) */
usersRouter.get('/', requireAuth, async (req, res) => {
  const where = req.user.role === ROLE_ADMIN ? {} : { hospitalId: req.user.hospitalId };
  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      hospitalId: true,
      createdAt: true,
      hospital: { select: { id: true, name: true } },
    },
  });
  res.json(users);
});

/** Créer un utilisateur (admin uniquement) - crée dans Firebase Auth + Firestore */
usersRouter.post(
  '/',
  requireAuth,
  requireAdmin,
  body('hospitalId').isString(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('role').isIn([0, 1, 2]),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const existing = await prisma.user.findFirst({ where: { email: req.body.email } });
    if (existing) return res.status(409).json({ error: 'Cet email est déjà utilisé' });

    try {
      const firebaseUser = await admin.auth().createUser({
        email: req.body.email,
        password: req.body.password,
        displayName: `${req.body.firstName} ${req.body.lastName}`,
      });

      const user = await prisma.user.create({
        data: {
          uid: firebaseUser.uid,
          email: req.body.email,
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          role: parseInt(req.body.role, 10),
          hospitalId: req.body.hospitalId,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          hospitalId: true,
          createdAt: true,
        },
      });

      res.status(201).json(user);
    } catch (err) {
      if (err.code === 'auth/email-already-exists') {
        return res.status(409).json({ error: 'Cet email existe déjà dans Firebase Auth' });
      }
      throw err;
    }
  }
);

/** Modifier le rôle d'un utilisateur (admin uniquement) */
usersRouter.patch(
  '/:id/role',
  requireAuth,
  requireAdmin,
  param('id').isString(),
  body('role').isIn([0, 1, 2]),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { role: parseInt(req.body.role, 10) },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        hospitalId: true,
        updatedAt: true,
      },
    });

    res.json(updated);
  }
);
