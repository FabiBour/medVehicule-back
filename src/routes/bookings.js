import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { loadVehicle, canUseVehicleType } from '../middleware/authorization.js';

export const bookingsRouter = Router();

/** Liste des réservations / prises (filtrée par utilisateur ou tous pour superviseur) */
bookingsRouter.get(
  '/',
  requireAuth,
  query('vehicleId').optional().isString(),
  query('userId').optional().isString(),
  query('status').optional().isIn(['planned', 'in_progress', 'completed', 'cancelled']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const where = {};
    if (req.user.role !== 'supervisor' && req.user.role !== 'admin') {
      where.userId = req.user.id;
    } else {
      if (req.query.userId) where.userId = req.query.userId;
      if (req.query.vehicleId) where.vehicleId = req.query.vehicleId;
      if (req.query.status) where.status = req.query.status;
    }
    const bookings = await prisma.booking.findMany({
      where,
      include: {
        vehicle: { include: { vehicleType: true, hospital: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { startDate: 'desc' },
    });
    res.json(bookings);
  }
);

bookingsRouter.get(
  '/:id',
  requireAuth,
  param('id').isString(),
  async (req, res) => {
    const b = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        vehicle: { include: { vehicleType: true, hospital: true, photos: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    if (!b) return res.status(404).json({ error: 'Réservation introuvable' });
    if (b.userId !== req.user.id && req.user.hospitalId !== b.vehicle.hospitalId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    res.json(b);
  }
);

/** Middleware: charge le véhicule depuis body.vehicleId */
async function loadVehicleFromBody(req, res, next) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: req.body.vehicleId },
    include: { vehicleType: true, hospital: true },
  });
  if (!vehicle) return res.status(404).json({ error: 'Véhicule introuvable' });
  if (vehicle.hospitalId !== req.user.hospitalId) {
    return res.status(403).json({ error: 'Véhicule d\'un autre établissement' });
  }
  req.vehicle = vehicle;
  next();
}

/** Créer une réservation / prise de véhicule (vérifie le droit sur le type) */
bookingsRouter.post(
  '/',
  requireAuth,
  body('vehicleId').isString(),
  body('startDate').isISO8601(),
  body('endDate').optional().isISO8601(),
  body('notes').optional().trim(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  },
  loadVehicleFromBody,
  canUseVehicleType,
  async (req, res) => {
    const startDate = new Date(req.body.startDate);
    const endDate = req.body.endDate ? new Date(req.body.endDate) : null;
    const booking = await prisma.booking.create({
      data: {
        vehicleId: req.body.vehicleId,
        userId: req.user.id,
        startDate,
        endDate,
        status: 'planned',
        notes: req.body.notes || null,
      },
      include: {
        vehicle: { include: { vehicleType: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    res.status(201).json(booking);
  }
);

/** Démarrer la prise (passer en in_progress), optionnel: relevé compteur départ */
bookingsRouter.patch(
  '/:id/start',
  requireAuth,
  param('id').isString(),
  body('odometerStart').optional().isInt({ min: 0 }),
  async (req, res) => {
    const b = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { vehicle: true, user: true },
    });
    if (!b) return res.status(404).json({ error: 'Réservation introuvable' });
    if (b.userId !== req.user.id) return res.status(403).json({ error: 'Ce n\'est pas votre réservation' });
    if (b.status !== 'planned') return res.status(400).json({ error: 'Réservation déjà démarrée ou terminée' });
    const updated = await prisma.booking.update({
      where: { id: b.id },
      data: {
        status: 'in_progress',
        ...(req.body.odometerStart != null && { odometerStart: parseInt(req.body.odometerStart, 10) }),
      },
      include: { vehicle: { include: { vehicleType: true } }, user: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.json(updated);
  }
);

/** Terminer la prise (restitution), relevé compteur fin */
bookingsRouter.patch(
  '/:id/complete',
  requireAuth,
  param('id').isString(),
  body('odometerEnd').isInt({ min: 0 }),
  body('notes').optional().trim(),
  async (req, res) => {
    const b = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { vehicle: true },
    });
    if (!b) return res.status(404).json({ error: 'Réservation introuvable' });
    if (b.userId !== req.user.id) return res.status(403).json({ error: 'Ce n\'est pas votre réservation' });
    if (b.status !== 'in_progress') return res.status(400).json({ error: 'Réservation non en cours' });
    const updated = await prisma.booking.update({
      where: { id: b.id },
      data: {
        status: 'completed',
        endDate: new Date(),
        odometerEnd: parseInt(req.body.odometerEnd, 10),
        ...(req.body.notes != null && { notes: (b.notes || '') + (req.body.notes ? '\n' + req.body.notes : '') }),
      },
      include: { vehicle: { include: { vehicleType: true } }, user: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.json(updated);
  }
);

/** Annuler une réservation */
bookingsRouter.patch(
  '/:id/cancel',
  requireAuth,
  param('id').isString(),
  async (req, res) => {
    const b = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!b) return res.status(404).json({ error: 'Réservation introuvable' });
    if (b.userId !== req.user.id && req.user.role !== 'supervisor' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    if (b.status === 'completed') return res.status(400).json({ error: 'Réservation déjà terminée' });
    await prisma.booking.update({
      where: { id: b.id },
      data: { status: 'cancelled' },
    });
    res.json({ ok: true, message: 'Réservation annulée' });
  }
);
