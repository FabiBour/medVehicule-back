import { Router } from 'express';
import path from 'path';
import { param, validationResult } from 'express-validator';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { loadVehicle } from '../middleware/authorization.js';
import { uploadModel3D } from '../middleware/upload.js';

export const vehicle3dRouter = Router();
const UPLOAD_BASE_3D = '/uploads/models3d';

/**
 * Retourne l'objet 3D du véhicule (format glTF/GLB utilisable iOS, Android, Web).
 * GET /api/vehicles/:vehicleId/3d retourne { format, url } pour affichage dans les apps.
 */
vehicle3dRouter.get(
  '/vehicle/:vehicleId',
  requireAuth,
  param('vehicleId').isString(),
  loadVehicle,
  async (req, res) => {
    const model = await prisma.vehicle3D.findUnique({
      where: { vehicleId: req.vehicle.id },
    });
    if (!model) return res.status(404).json({ error: 'Modèle 3D non disponible pour ce véhicule' });
    const url = model.url.startsWith('http') || model.url.startsWith('/')
      ? model.url
      : `${UPLOAD_BASE_3D}/${path.basename(model.url)}`;
    res.json({
      id: model.id,
      vehicleId: model.vehicleId,
      format: model.format,
      url,
      createdAt: model.createdAt,
    });
  }
);

/** Upload d'un modèle 3D (glb/gltf) - superviseur */
vehicle3dRouter.post(
  '/vehicle/:vehicleId',
  requireAuth,
  param('vehicleId').isString(),
  loadVehicle,
  async (req, res, next) => {
    if (req.user.role !== 1 && req.user.role !== 2) {
      return res.status(403).json({ error: 'Droits superviseur requis' });
    }
    next();
  },
  uploadModel3D.single('model'),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Fichier modèle 3D requis (glb ou gltf)' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    const format = ext === '.glb' ? 'glb' : 'gltf';
    const relativePath = `models3d/${req.file.filename}`;
    const existing = await prisma.vehicle3D.findUnique({
      where: { vehicleId: req.vehicle.id },
    });
    let model;
    if (existing) {
      model = await prisma.vehicle3D.update({
        where: { vehicleId: req.vehicle.id },
        data: { format, url: relativePath },
      });
    } else {
      model = await prisma.vehicle3D.create({
        data: {
          vehicleId: req.vehicle.id,
          format,
          url: relativePath,
        },
      });
    }
    res.status(existing ? 200 : 201).json({
      ...model,
      url: `${UPLOAD_BASE_3D}/${req.file.filename}`,
    });
  }
);

/** Supprimer le modèle 3D */
vehicle3dRouter.delete(
  '/vehicle/:vehicleId',
  requireAuth,
  param('vehicleId').isString(),
  loadVehicle,
  async (req, res) => {
    if (req.user.role !== 1 && req.user.role !== 2) {
      return res.status(403).json({ error: 'Droits superviseur requis' });
    }
    await prisma.vehicle3D.deleteMany({ where: { vehicleId: req.vehicle.id } });
    res.status(204).send();
  }
);
