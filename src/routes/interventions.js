import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { prisma } from '../db.js';
import { requireAuth, requireSupervisor } from '../middleware/auth.js';
import { loadVehicle } from '../middleware/authorization.js';

export const interventionsRouter = Router();

/** Liste des demandes d'intervention (personnel: les siennes, superviseur: toutes de l'établissement) */
interventionsRouter.get(
  '/',
  requireAuth,
  query('vehicleId').optional().isString(),
  query('status').optional().isIn(['nouvelle', 'en_cours', 'terminee', 'rejetee']),
  query('createdBy').optional().isString(),
  async (req, res) => {
    const where = {};
    if (req.user.role !== 'supervisor' && req.user.role !== 'admin') {
      where.createdById = req.user.id;
    } else {
      if (req.query.createdBy) where.createdById = req.query.createdBy;
      if (req.query.vehicleId) {
        const v = await prisma.vehicle.findUnique({ where: { id: req.query.vehicleId } });
        if (v && v.hospitalId !== req.user.hospitalId && req.user.role !== 'admin') where.vehicleId = 'impossible';
        else where.vehicleId = req.query.vehicleId;
      }
    }
    if (req.query.status) where.status = req.query.status;
    if (where.vehicleId === 'impossible') return res.json([]);
    const list = await prisma.interventionRequest.findMany({
      where,
      include: {
        vehicle: { include: { vehicleType: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const filtered = list.filter((r) => r.vehicle.hospitalId === req.user.hospitalId || req.user.role === 'admin');
    res.json(filtered);
  }
);

interventionsRouter.get(
  '/:id',
  requireAuth,
  param('id').isString(),
  async (req, res) => {
    const req_ = await prisma.interventionRequest.findUnique({
      where: { id: req.params.id },
      include: {
        vehicle: { include: { vehicleType: true, hospital: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!req_) return res.status(404).json({ error: 'Demande introuvable' });
    if (req_.vehicle.hospitalId !== req.user.hospitalId && req.user.role !== 'admin') {
      if (req_.createdById !== req.user.id) return res.status(403).json({ error: 'Accès refusé' });
    }
    res.json(req_);
  }
);

/** Créer une demande d'intervention (personnel → superviseur) */
interventionsRouter.post(
  '/',
  requireAuth,
  body('vehicleId').isString(),
  body('title').trim().notEmpty(),
  body('description').optional().trim(),
  body('priority').optional().isIn(['basse', 'normal', 'haute', 'urgent']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.body.vehicleId } });
    if (!vehicle) return res.status(404).json({ error: 'Véhicule introuvable' });
    if (vehicle.hospitalId !== req.user.hospitalId) return res.status(403).json({ error: 'Accès refusé' });
    const intervention = await prisma.interventionRequest.create({
      data: {
        vehicleId: req.body.vehicleId,
        createdById: req.user.id,
        title: req.body.title,
        description: req.body.description || null,
        priority: req.body.priority || 'normal',
      },
      include: {
        vehicle: { include: { vehicleType: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        statusHistory: true,
      },
    });
    await prisma.interventionStatusHistory.create({
      data: { requestId: intervention.id, status: 'nouvelle', comment: 'Demande créée' },
    });
    const withHistory = await prisma.interventionRequest.findUnique({
      where: { id: intervention.id },
      include: {
        vehicle: { include: { vehicleType: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });
    res.status(201).json(withHistory);
  }
);

/** Mettre à jour statut / assignation (superviseur) */
interventionsRouter.patch(
  '/:id',
  requireAuth,
  param('id').isString(),
  body('status').optional().isIn(['nouvelle', 'en_cours', 'terminee', 'rejetee']),
  body('assignedToId').optional().isString(),
  body('comment').optional().trim(),
  async (req, res) => {
    const ir = await prisma.interventionRequest.findUnique({
      where: { id: req.params.id },
      include: { vehicle: true },
    });
    if (!ir) return res.status(404).json({ error: 'Demande introuvable' });
    if (ir.vehicle.hospitalId !== req.user.hospitalId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    const data = {};
    if (req.body.status != null) {
      data.status = req.body.status;
      if (req.body.status === 'terminee' || req.body.status === 'rejetee') {
        data.resolvedAt = new Date();
      }
    }
    if (req.body.assignedToId !== undefined) data.assignedToId = req.body.assignedToId || null;
    const updated = await prisma.interventionRequest.update({
      where: { id: ir.id },
      data,
      include: {
        vehicle: { include: { vehicleType: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        statusHistory: true,
      },
    });
    if (req.body.status != null || req.body.comment) {
      await prisma.interventionStatusHistory.create({
        data: {
          requestId: ir.id,
          status: updated.status,
          comment: req.body.comment || null,
        },
      });
    }
    const withHistory = await prisma.interventionRequest.findUnique({
      where: { id: ir.id },
      include: {
        vehicle: { include: { vehicleType: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });
    res.json(withHistory);
  }
);
