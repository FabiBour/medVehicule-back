import { Router } from 'express';
import path from 'path';
import { param, body, validationResult } from 'express-validator';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { loadVehicle } from '../middleware/authorization.js';
import { uploadPhoto } from '../middleware/upload.js';

export const photosRouter = Router();
const UPLOAD_BASE = '/uploads/photos';

/** Liste des photos d'un véhicule */
photosRouter.get(
  '/vehicle/:vehicleId',
  requireAuth,
  param('vehicleId').isString(),
  loadVehicle,
  async (req, res) => {
    const photos = await prisma.vehiclePhoto.findMany({
      where: { vehicleId: req.vehicle.id },
      orderBy: { takenAt: 'desc' },
    });
    const withUrl = photos.map((p) => ({
      ...p,
      url: p.url.startsWith('http') || p.url.startsWith('/') ? p.url : `${UPLOAD_BASE}/${path.basename(p.url)}`,
    }));
    res.json(withUrl);
  }
);

/** Ajouter une photo (état des lieux, récupération) - multipart/form-data */
photosRouter.post(
  '/vehicle/:vehicleId',
  requireAuth,
  param('vehicleId').isString(),
  loadVehicle,
  uploadPhoto.single('photo'),
  body('label').optional().trim(),
  body('bookingId').optional().isString(),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Fichier photo requis' });
    const label = req.body?.label || null;
    const bookingId = req.body?.bookingId || null;
    const relativePath = `photos/${req.file.filename}`;
    const photo = await prisma.vehiclePhoto.create({
      data: {
        vehicleId: req.vehicle.id,
        url: relativePath,
        label,
        bookingId,
      },
    });
    res.status(201).json({
      ...photo,
      url: `${UPLOAD_BASE}/${req.file.filename}`,
    });
  }
);

/** Supprimer une photo */
photosRouter.delete(
  '/:photoId',
  requireAuth,
  param('photoId').isString(),
  async (req, res) => {
    const photo = await prisma.vehiclePhoto.findUnique({
      where: { id: req.params.photoId },
      include: { vehicle: true },
    });
    if (!photo) return res.status(404).json({ error: 'Photo introuvable' });
    if (photo.vehicle.hospitalId !== req.user.hospitalId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    await prisma.vehiclePhoto.delete({ where: { id: photo.id } });
    res.status(204).send();
  }
);
