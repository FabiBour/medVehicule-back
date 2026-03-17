import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { loadVehicle } from '../middleware/authorization.js';

export const odometerRouter = Router();

/** Relevés de compteur d'un véhicule */
odometerRouter.get(
  '/vehicle/:vehicleId',
  requireAuth,
  param('vehicleId').isString(),
  loadVehicle,
  query('limit').optional().isInt({ min: 1, max: 200 }),
  async (req, res) => {
    const limit = parseInt(req.query.limit || '50', 10);
    const readings = await prisma.odometerReading.findMany({
      where: { vehicleId: req.vehicle.id },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { readAt: 'desc' },
      take: limit,
    });
    res.json(readings);
  }
);

/** Enregistrer un relevé de compteur */
odometerRouter.post(
  '/vehicle/:vehicleId',
  requireAuth,
  param('vehicleId').isString(),
  loadVehicle,
  body('value').isInt({ min: 0 }),
  body('bookingId').optional().isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const reading = await prisma.odometerReading.create({
      data: {
        vehicleId: req.vehicle.id,
        userId: req.user.id,
        value: parseInt(req.body.value, 10),
        bookingId: req.body.bookingId || null,
      },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.status(201).json(reading);
  }
);
