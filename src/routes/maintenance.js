import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { prisma } from '../db.js';
import { requireAuth, requireSupervisor } from '../middleware/auth.js';
import { loadVehicle } from '../middleware/authorization.js';

export const maintenanceRouter = Router();

/** Liste des maintenances (véhicule ou global) */
maintenanceRouter.get(
  '/',
  requireAuth,
  query('vehicleId').optional().isString(),
  query('type').optional().isIn(['controle_technique', 'revision', 'reparation', 'autre']),
  query('status').optional().isIn(['planifie', 'en_cours', 'termine', 'reporte']),
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
    if (req.query.type) where.type = req.query.type;
    if (req.query.status) where.status = req.query.status;
    const list = await prisma.maintenance.findMany({
      where,
      include: {
        vehicle: { include: { vehicleType: true } },
        garage: true,
        contract: true,
      },
      orderBy: { scheduledAt: 'desc' },
    });
    res.json(list);
  }
);

// Routes garages et contrats avant /:id pour éviter que "garages" soit pris pour un id
maintenanceRouter.get('/garages/list', requireAuth, async (req, res) => {
  const where = req.user.role === 2 ? {} : { hospitalId: req.user.hospitalId };
  const list = await prisma.partnerGarage.findMany({ where });
  res.json(list);
});

maintenanceRouter.post(
  '/garages',
  requireAuth,
  requireSupervisor,
  body('hospitalId').isString(),
  body('name').trim().notEmpty(),
  body('address').optional().trim(),
  body('contact').optional().trim(),
  async (req, res) => {
    if (req.user.hospitalId !== req.body.hospitalId && req.user.role !== 2) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    const garage = await prisma.partnerGarage.create({
      data: {
        hospitalId: req.body.hospitalId,
        name: req.body.name,
        address: req.body.address || null,
        contact: req.body.contact || null,
      },
    });
    res.status(201).json(garage);
  }
);

maintenanceRouter.get('/contracts/vehicle/:vehicleId', requireAuth, param('vehicleId').isString(), loadVehicle, async (req, res) => {
  const list = await prisma.maintenanceContract.findMany({
    where: { vehicleId: req.vehicle.id },
  });
  res.json(list);
});

maintenanceRouter.post(
  '/contracts',
  requireAuth,
  requireSupervisor,
  body('vehicleId').isString(),
  body('type').isIn(['entretien_courant', 'assurance', 'leasing']),
  body('garageId').optional().isString(),
  body('startDate').isISO8601(),
  body('endDate').optional().isISO8601(),
  body('reference').optional().trim(),
  body('notes').optional().trim(),
  async (req, res) => {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.body.vehicleId } });
    if (!vehicle) return res.status(404).json({ error: 'Véhicule introuvable' });
    if (vehicle.hospitalId !== req.user.hospitalId && req.user.role !== 2) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    const contract = await prisma.maintenanceContract.create({
      data: {
        vehicleId: req.body.vehicleId,
        garageId: req.body.garageId || null,
        type: req.body.type,
        startDate: new Date(req.body.startDate),
        endDate: req.body.endDate ? new Date(req.body.endDate) : null,
        reference: req.body.reference || null,
        notes: req.body.notes || null,
      },
    });
    res.status(201).json(contract);
  }
);

maintenanceRouter.get(
  '/:id',
  requireAuth,
  param('id').isString(),
  async (req, res) => {
    const m = await prisma.maintenance.findUnique({
      where: { id: req.params.id },
      include: {
        vehicle: { include: { vehicleType: true, hospital: true } },
        garage: true,
        contract: true,
      },
    });
    if (!m) return res.status(404).json({ error: 'Entretien introuvable' });
    if (m.vehicle.hospitalId !== req.user.hospitalId && req.user.role !== 2) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    res.json(m);
  }
);

/** Créer un entretien (CT, révision, etc.) - superviseur */
maintenanceRouter.post(
  '/',
  requireAuth,
  requireSupervisor,
  body('vehicleId').isString(),
  body('type').isIn(['controle_technique', 'revision', 'reparation', 'autre']),
  body('garageId').optional().isString(),
  body('contractId').optional().isString(),
  body('scheduledAt').optional().isISO8601(),
  body('odometerAt').optional().isInt({ min: 0 }),
  body('notes').optional().trim(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.body.vehicleId } });
    if (!vehicle) return res.status(404).json({ error: 'Véhicule introuvable' });
    if (vehicle.hospitalId !== req.user.hospitalId && req.user.role !== 2) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    const maintenance = await prisma.maintenance.create({
      data: {
        vehicleId: req.body.vehicleId,
        garageId: req.body.garageId || null,
        contractId: req.body.contractId || null,
        type: req.body.type,
        scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : null,
        odometerAt: req.body.odometerAt ? parseInt(req.body.odometerAt, 10) : null,
        notes: req.body.notes || null,
      },
      include: { vehicle: { include: { vehicleType: true } }, garage: true, contract: true },
    });
    res.status(201).json(maintenance);
  }
);

maintenanceRouter.patch(
  '/:id',
  requireAuth,
  requireSupervisor,
  param('id').isString(),
  body('scheduledAt').optional().isISO8601(),
  body('performedAt').optional().isISO8601(),
  body('odometerAt').optional().isInt({ min: 0 }),
  body('cost').optional().isFloat(),
  body('notes').optional().trim(),
  body('status').optional().isIn(['planifie', 'en_cours', 'termine', 'reporte']),
  async (req, res) => {
    const m = await prisma.maintenance.findUnique({
      where: { id: req.params.id },
      include: { vehicle: true },
    });
    if (!m) return res.status(404).json({ error: 'Entretien introuvable' });
    if (m.vehicle.hospitalId !== req.user.hospitalId && req.user.role !== 2) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    const data = {};
    if (req.body.scheduledAt !== undefined) data.scheduledAt = req.body.scheduledAt ? new Date(req.body.scheduledAt) : null;
    if (req.body.performedAt !== undefined) data.performedAt = req.body.performedAt ? new Date(req.body.performedAt) : null;
    if (req.body.odometerAt !== undefined) data.odometerAt = req.body.odometerAt != null ? parseInt(req.body.odometerAt, 10) : null;
    if (req.body.cost !== undefined) data.cost = req.body.cost != null ? parseFloat(req.body.cost) : null;
    if (req.body.notes !== undefined) data.notes = req.body.notes || null;
    if (req.body.status !== undefined) data.status = req.body.status;
    const updated = await prisma.maintenance.update({
      where: { id: m.id },
      data,
      include: { vehicle: { include: { vehicleType: true } }, garage: true, contract: true },
    });
    res.json(updated);
  }
);
