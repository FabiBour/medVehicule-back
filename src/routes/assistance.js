import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { loadVehicle } from '../middleware/authorization.js';

export const assistanceRouter = Router();

/** Liste des demandes d'assistance */
assistanceRouter.get(
  '/',
  requireAuth,
  query('vehicleId').optional().isString(),
  query('status').optional().isIn(['ouverte', 'en_route', 'traitee']),
  async (req, res) => {
    const where = {};
    if (req.query.vehicleId) {
      const v = await prisma.vehicle.findUnique({ where: { id: req.query.vehicleId } });
      if (!v) return res.json([]);
      if (v.hospitalId !== req.user.hospitalId && req.user.role !== 2) return res.status(403).json({ error: 'Accès refusé' });
      where.vehicleId = req.query.vehicleId;
    } else {
      const vehicles = await prisma.vehicle.findMany({
        where: req.user.role !== 2 ? { hospitalId: req.user.hospitalId } : {},
        select: { id: true },
      });
      where.vehicleId = { in: vehicles.map((x) => x.id) };
    }
    if (req.query.status) where.status = req.query.status;
    const list = await prisma.assistanceRequest.findMany({
      where,
      include: { vehicle: { include: { vehicleType: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(list);
  }
);

/** Créer une demande d'assistance (panne, dépannage) */
assistanceRouter.post(
  '/',
  requireAuth,
  body('vehicleId').isString(),
  body('type').isIn(['panne', 'accident', 'depannage']),
  body('description').optional().trim(),
  body('location').optional().trim(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.body.vehicleId } });
    if (!vehicle) return res.status(404).json({ error: 'Véhicule introuvable' });
    if (vehicle.hospitalId !== req.user.hospitalId) return res.status(403).json({ error: 'Accès refusé' });
    const request = await prisma.assistanceRequest.create({
      data: {
        vehicleId: req.body.vehicleId,
        type: req.body.type,
        description: req.body.description || null,
        location: req.body.location || null,
      },
      include: { vehicle: { include: { vehicleType: true } } },
    });
    res.status(201).json(request);
  }
);

assistanceRouter.patch(
  '/:id',
  requireAuth,
  param('id').isString(),
  body('status').isIn(['ouverte', 'en_route', 'traitee']),
  async (req, res) => {
    const ar = await prisma.assistanceRequest.findUnique({
      where: { id: req.params.id },
      include: { vehicle: true },
    });
    if (!ar) return res.status(404).json({ error: 'Demande introuvable' });
    if (ar.vehicle.hospitalId !== req.user.hospitalId) return res.status(403).json({ error: 'Accès refusé' });
    const updated = await prisma.assistanceRequest.update({
      where: { id: ar.id },
      data: { status: req.body.status },
      include: { vehicle: { include: { vehicleType: true } } },
    });
    res.json(updated);
  }
);
