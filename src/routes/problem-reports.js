import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { loadVehicle } from '../middleware/authorization.js';

export const problemReportsRouter = Router();

problemReportsRouter.get(
  '/',
  requireAuth,
  query('vehicleId').optional().isString(),
  query('status').optional().isIn(['ouvert', 'en_cours', 'cloture']),
  async (req, res) => {
    const where = {};
    if (req.query.vehicleId) where.vehicleId = req.query.vehicleId;
    if (req.query.status) where.status = req.query.status;
    const vehicles = await prisma.vehicle.findMany({
      where: req.user.role !== 'admin' ? { hospitalId: req.user.hospitalId } : {},
      select: { id: true },
    });
    const vehicleIds = vehicles.map((v) => v.id);
    where.vehicleId = where.vehicleId ? (vehicleIds.includes(where.vehicleId) ? where.vehicleId : '') : { in: vehicleIds };
    if (where.vehicleId === '') return res.json([]);
    const list = await prisma.problemReport.findMany({
      where,
      include: {
        vehicle: { select: { id: true, registration: true, brand: true, model: true, vehicleType: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(list);
  }
);

problemReportsRouter.get(
  '/:id',
  requireAuth,
  param('id').isString(),
  async (req, res) => {
    const report = await prisma.problemReport.findUnique({
      where: { id: req.params.id },
      include: {
        vehicle: { include: { vehicleType: true, hospital: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    if (!report) return res.status(404).json({ error: 'Signalement introuvable' });
    if (report.vehicle.hospitalId !== req.user.hospitalId) return res.status(403).json({ error: 'Accès refusé' });
    res.json(report);
  }
);

/** Créer un signalement (rayure, impact, etc.) */
problemReportsRouter.post(
  '/',
  requireAuth,
  body('vehicleId').isString(),
  body('type').isIn(['rayure', 'impact', 'panne', 'autre']),
  body('description').optional().trim(),
  body('severity').optional().isIn(['mineur', 'moyen', 'majeur']),
  body('bookingId').optional().isString(),
  body('photoIds').optional(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: req.body.vehicleId },
      include: { hospital: true },
    });
    if (!vehicle) return res.status(404).json({ error: 'Véhicule introuvable' });
    if (vehicle.hospitalId !== req.user.hospitalId) return res.status(403).json({ error: 'Véhicule d\'un autre établissement' });
    const photoIds = req.body.photoIds != null ? (typeof req.body.photoIds === 'string' ? req.body.photoIds : JSON.stringify(req.body.photoIds)) : null;
    const report = await prisma.problemReport.create({
      data: {
        vehicleId: req.body.vehicleId,
        userId: req.user.id,
        type: req.body.type,
        description: req.body.description || null,
        severity: req.body.severity || null,
        bookingId: req.body.bookingId || null,
        photoIds,
      },
      include: {
        vehicle: { include: { vehicleType: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    res.status(201).json(report);
  }
);

/** Mettre à jour le statut (superviseur ou créateur) */
problemReportsRouter.patch(
  '/:id',
  requireAuth,
  param('id').isString(),
  body('status').optional().isIn(['ouvert', 'en_cours', 'cloture']),
  body('description').optional().trim(),
  async (req, res) => {
    const report = await prisma.problemReport.findUnique({
      where: { id: req.params.id },
      include: { vehicle: true },
    });
    if (!report) return res.status(404).json({ error: 'Signalement introuvable' });
    if (report.vehicle.hospitalId !== req.user.hospitalId) return res.status(403).json({ error: 'Accès refusé' });
    const data = {};
    if (req.body.status != null) data.status = req.body.status;
    if (req.body.description != null) data.description = req.body.description;
    const updated = await prisma.problemReport.update({
      where: { id: report.id },
      data,
      include: { vehicle: { include: { vehicleType: true } }, user: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.json(updated);
  }
);
