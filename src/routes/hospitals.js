import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { prisma } from '../db.js';
import { requireAuth, requireSupervisor, sameHospital } from '../middleware/auth.js';

export const hospitalsRouter = Router();

hospitalsRouter.get('/', requireAuth, async (req, res) => {
  const list = await prisma.hospital.findMany({
    select: { id: true, name: true, address: true, createdAt: true },
  });
  res.json(list);
});

hospitalsRouter.get('/:id', requireAuth, param('id').isString(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const hospital = await prisma.hospital.findUnique({
    where: { id: req.params.id },
    include: {
      vehicles: { include: { vehicleType: true } },
      users: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
    },
  });
  if (!hospital) return res.status(404).json({ error: 'Établissement introuvable' });
  if (req.user.hospitalId !== hospital.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  res.json(hospital);
});

hospitalsRouter.post(
  '/',
  requireAuth,
  requireSupervisor,
  body('name').trim().notEmpty(),
  body('address').optional().trim(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const hospital = await prisma.hospital.create({
      data: { name: req.body.name, address: req.body.address || null },
    });
    res.status(201).json(hospital);
  }
);

hospitalsRouter.patch(
  '/:id',
  requireAuth,
  requireSupervisor,
  param('id').isString(),
  body('name').optional().trim().notEmpty(),
  body('address').optional().trim(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const hospital = await prisma.hospital.findUnique({ where: { id: req.params.id } });
    if (!hospital) return res.status(404).json({ error: 'Établissement introuvable' });
    if (req.user.hospitalId !== hospital.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    const updated = await prisma.hospital.update({
      where: { id: req.params.id },
      data: {
        ...(req.body.name != null && { name: req.body.name }),
        ...(req.body.address !== undefined && { address: req.body.address || null }),
      },
    });
    res.json(updated);
  }
);
