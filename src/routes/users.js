import { Router } from 'express';
import admin from 'firebase-admin';
import { body, param, validationResult } from 'express-validator';
import { prisma } from '../db.js';
import { requireAuth, requireAdmin, requireSuperAdmin } from '../middleware/auth.js';
import { ROLE_ADMIN, ROLE_SUPER_ADMIN } from '../lib/roles.js';

export const usersRouter = Router();

/** Liste des utilisateurs (établissement ou tous si admin/super_admin) */
usersRouter.get('/', requireAuth, async (req, res) => {
  const where = req.user.role === ROLE_ADMIN || req.user.role === ROLE_SUPER_ADMIN ? {} : { hospitalId: req.user.hospitalId };
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
  body('role').isIn([0, 1, 2, 3]),
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
  body('role').isIn([0, 1, 2, 3]),
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

/** Activer ou désactiver un utilisateur (admin ou super_admin) */
usersRouter.patch(
  '/:id/deactivate',
  requireAuth,
  (req, res, next) => {
    if (req.user.role === ROLE_ADMIN || req.user.role === ROLE_SUPER_ADMIN) return next();
    return res.status(403).json({ error: 'Droits administrateur requis' });
  },
  param('id').isString(),
  body('isDeactivated').isBoolean(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas désactiver votre propre compte' });
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isDeactivated: req.body.isDeactivated },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isDeactivated: true,
        hospitalId: true,
        updatedAt: true,
      },
    });

    res.json(updated);
  }
);

/** Affecter un usager ou gestionnaire à un ou plusieurs hôpitaux (super_admin uniquement) */
usersRouter.patch(
  '/:id/hospitals',
  requireAuth,
  requireSuperAdmin,
  param('id').isString(),
  body('hospitalIds').isArray(),
  body('hospitalIds.*').isString().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { id } = req.params;
    const { hospitalIds } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    if (user.role !== 0 && user.role !== 1) {
      return res.status(400).json({
        error: 'Seuls les usagers (0) et gestionnaires (1) peuvent être affectés à des hôpitaux',
      });
    }

    for (const hid of hospitalIds) {
      const h = await prisma.hospital.findUnique({ where: { id: hid } });
      if (!h) return res.status(400).json({ error: `Hôpital "${hid}" introuvable` });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        hospitalIds: hospitalIds,
        hospitalId: hospitalIds[0] || null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        hospitalId: true,
        hospitalIds: true,
        updatedAt: true,
      },
    });

    res.json(updated);
  }
);
