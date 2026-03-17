import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { prisma } from '../db.js';
import { requireAuth, requireSupervisor } from '../middleware/auth.js';
import { loadVehicle } from '../middleware/authorization.js';

export const vehiclesRouter = Router();

vehiclesRouter.get(
  '/',
  requireAuth,
  query('hospitalId').optional().isString(),
  query('vehicleTypeId').optional().isString(),
  query('available').optional().isIn(['true', 'false']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const where = {};
    if (req.user.role !== 0) where.hospitalId = req.user.hospitalId;
    else if (req.query.hospitalId) where.hospitalId = req.query.hospitalId;
    if (req.query.vehicleTypeId) where.vehicleTypeId = req.query.vehicleTypeId;
    if (req.query.available === 'true') {
      where.bookings = {
        none: {
          status: 'in_progress',
          endDate: null,
        },
      };
    }
    const vehicles = await prisma.vehicle.findMany({
      where,
      include: {
        vehicleType: true,
        hospital: { select: { id: true, name: true } },
        photos: { take: 5, orderBy: { takenAt: 'desc' } },
        model3D: true,
      },
    });
    res.json(vehicles);
  }
);

vehiclesRouter.get(
  '/:vehicleId',
  requireAuth,
  param('vehicleId').isString(),
  loadVehicle,
  async (req, res) => {
    const v = await prisma.vehicle.findUnique({
      where: { id: req.vehicle.id },
      include: {
        vehicleType: true,
        hospital: true,
        photos: true,
        model3D: true,
        maintenances: { orderBy: { scheduledAt: 'desc' }, take: 20 },
        maintenanceContracts: true,
      },
    });
    res.json(v);
  }
);

vehiclesRouter.post(
  '/',
  requireAuth,
  requireSupervisor,
  body('hospitalId').isString(),
  body('vehicleTypeId').isString(),
  body('registration').optional().trim(),
  body('brand').optional().trim(),
  body('model').optional().trim(),
  body('year').optional().isInt({ min: 1900, max: 2100 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    if (req.user.hospitalId !== req.body.hospitalId && req.user.role !== 0) {
      return res.status(403).json({ error: 'Création véhicule pour un autre établissement non autorisée' });
    }
    const vehicle = await prisma.vehicle.create({
      data: {
        hospitalId: req.body.hospitalId,
        vehicleTypeId: req.body.vehicleTypeId,
        registration: req.body.registration || null,
        brand: req.body.brand || null,
        model: req.body.model || null,
        year: req.body.year ? parseInt(req.body.year, 10) : null,
      },
      include: { vehicleType: true, hospital: true },
    });
    res.status(201).json(vehicle);
  }
);

vehiclesRouter.patch(
  '/:vehicleId',
  requireAuth,
  requireSupervisor,
  param('vehicleId').isString(),
  loadVehicle,
  body('registration').optional().trim(),
  body('brand').optional().trim(),
  body('model').optional().trim(),
  body('year').optional().isInt({ min: 1900, max: 2100 }),
  body('vehicleTypeId').optional().isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const data = {};
    if (req.body.registration !== undefined) data.registration = req.body.registration || null;
    if (req.body.brand !== undefined) data.brand = req.body.brand || null;
    if (req.body.model !== undefined) data.model = req.body.model || null;
    if (req.body.year !== undefined) data.year = req.body.year ? parseInt(req.body.year, 10) : null;
    if (req.body.vehicleTypeId !== undefined) data.vehicleTypeId = req.body.vehicleTypeId;
    const updated = await prisma.vehicle.update({
      where: { id: req.vehicle.id },
      data,
      include: { vehicleType: true, hospital: true },
    });
    res.json(updated);
  }
);

vehiclesRouter.delete(
  '/:vehicleId',
  requireAuth,
  requireSupervisor,
  param('vehicleId').isString(),
  loadVehicle,
  async (req, res) => {
    await prisma.vehicle.delete({ where: { id: req.vehicle.id } });
    res.status(204).send();
  }
);

/** Historique agrégé du véhicule : prises, interventions, entretiens */
vehiclesRouter.get(
  '/:vehicleId/history',
  requireAuth,
  param('vehicleId').isString(),
  loadVehicle,
  async (req, res) => {
    const [bookings, interventions, maintenances] = await Promise.all([
      prisma.booking.findMany({
        where: { vehicleId: req.vehicle.id },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { startDate: 'desc' },
        take: 100,
      }),
      prisma.interventionRequest.findMany({
        where: { vehicleId: req.vehicle.id },
        include: { createdBy: { select: { id: true, firstName: true, lastName: true } }, statusHistory: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.maintenance.findMany({
        where: { vehicleId: req.vehicle.id },
        include: { garage: true },
        orderBy: { scheduledAt: 'desc' },
        take: 50,
      }),
    ]);
    res.json({
      vehicleId: req.vehicle.id,
      bookings,
      interventions,
      maintenances,
    });
  }
);
