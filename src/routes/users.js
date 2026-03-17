import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { body, param, validationResult } from 'express-validator';
import { prisma } from '../db.js';
import { requireAuth, requireSupervisor } from '../middleware/auth.js';

export const usersRouter = Router();

/** Liste des utilisateurs (établissement ou tous si admin) */
usersRouter.get('/', requireAuth, async (req, res) => {
  const where = req.user.role === 'admin' ? {} : { hospitalId: req.user.hospitalId };
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

/** Créer un utilisateur (superviseur/admin) */
usersRouter.post(
  '/',
  requireAuth,
  requireSupervisor,
  body('hospitalId').isString(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('role').isIn(['staff', 'supervisor', 'admin']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    if (req.user.hospitalId !== req.body.hospitalId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    const existing = await prisma.user.findFirst({ where: { email: req.body.email } });
    if (existing) return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    const passwordHash = await bcrypt.hash(req.body.password, 10);
    const user = await prisma.user.create({
      data: {
        hospitalId: req.body.hospitalId,
        email: req.body.email,
        passwordHash,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        role: req.body.role,
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
  }
);

