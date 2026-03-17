import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { prisma } from '../db.js';
import { requireAuth, requireSupervisor } from '../middleware/auth.js';

export const vehicleTypesRouter = Router();

vehicleTypesRouter.get('/', requireAuth, async (req, res) => {
  const list = await prisma.vehicleType.findMany({
    orderBy: { name: 'asc' },
  });
  res.json(list);
});

vehicleTypesRouter.get('/:id', requireAuth, param('id').isString(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const vt = await prisma.vehicleType.findUnique({
    where: { id: req.params.id },
    include: { vehicles: true },
  });
  if (!vt) return res.status(404).json({ error: 'Type de véhicule introuvable' });
  res.json(vt);
});

vehicleTypesRouter.post(
  '/',
  requireAuth,
  requireSupervisor,
  body('name').trim().notEmpty(),
  body('description').optional().trim(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const vt = await prisma.vehicleType.create({
      data: { name: req.body.name, description: req.body.description || null },
    });
    res.status(201).json(vt);
  }
);

vehicleTypesRouter.patch(
  '/:id',
  requireAuth,
  requireSupervisor,
  param('id').isString(),
  body('name').optional().trim().notEmpty(),
  body('description').optional().trim(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const vt = await prisma.vehicleType.findUnique({ where: { id: req.params.id } });
    if (!vt) return res.status(404).json({ error: 'Type de véhicule introuvable' });
    const updated = await prisma.vehicleType.update({
      where: { id: req.params.id },
      data: {
        ...(req.body.name != null && { name: req.body.name }),
        ...(req.body.description !== undefined && { description: req.body.description || null }),
      },
    });
    res.json(updated);
  }
);
