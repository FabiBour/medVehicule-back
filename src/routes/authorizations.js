import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { prisma } from '../db.js';
import { requireAuth, requireSupervisor } from '../middleware/auth.js';

export const authorizationsRouter = Router();

/** Liste des droits d'utilisation (pour l'hôpital de l'utilisateur ou tous si admin) */
authorizationsRouter.get(
  '/',
  requireAuth,
  async (req, res) => {
    const where = req.user.role === 0 ? {} : { user: { hospitalId: req.user.hospitalId } };
    const list = await prisma.authorization.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, hospitalId: true } },
        vehicleType: true,
      },
    });
    res.json(list);
  }
);

/** Droits d'un utilisateur */
authorizationsRouter.get(
  '/user/:userId',
  requireAuth,
  param('userId').isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      include: { hospital: true },
    });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (user.hospitalId !== req.user.hospitalId && req.user.role !== 0) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    const auths = await prisma.authorization.findMany({
      where: { userId: user.id, revokedAt: null },
      include: { vehicleType: true },
    });
    res.json(auths);
  }
);

/** Accorder un droit (superviseur uniquement) */
authorizationsRouter.post(
  '/',
  requireAuth,
  requireSupervisor,
  body('userId').isString(),
  body('vehicleTypeId').isString(),
  body('expiresAt').optional().isISO8601(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const user = await prisma.user.findUnique({ where: { id: req.body.userId } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (user.hospitalId !== req.user.hospitalId && req.user.role !== 0) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    const existing = await prisma.authorization.findUnique({
      where: {
        userId_vehicleTypeId: { userId: req.body.userId, vehicleTypeId: req.body.vehicleTypeId },
      },
    });
    if (existing && !existing.revokedAt) {
      return res.status(409).json({ error: 'Ce droit existe déjà' });
    }
    if (existing && existing.revokedAt) {
      const auth = await prisma.authorization.update({
        where: { id: existing.id },
        data: { revokedAt: null, expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null, grantedBy: req.user.id, grantedAt: new Date() },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } }, vehicleType: true },
      });
      return res.status(201).json(auth);
    }
    const auth = await prisma.authorization.create({
      data: {
        userId: req.body.userId,
        vehicleTypeId: req.body.vehicleTypeId,
        grantedBy: req.user.id,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
      },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } }, vehicleType: true },
    });
    res.status(201).json(auth);
  }
);

/** Révoquer un droit */
authorizationsRouter.post(
  '/:id/revoke',
  requireAuth,
  requireSupervisor,
  param('id').isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const auth = await prisma.authorization.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });
    if (!auth) return res.status(404).json({ error: 'Autorisation introuvable' });
    if (auth.user.hospitalId !== req.user.hospitalId && req.user.role !== 0) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    await prisma.authorization.update({
      where: { id: req.params.id },
      data: { revokedAt: new Date() },
    });
    res.json({ ok: true, message: 'Droit révoqué' });
  }
);
