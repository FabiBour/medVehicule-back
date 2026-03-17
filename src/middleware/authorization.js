import { prisma } from '../db.js';

/**
 * Vérifie que l'utilisateur a le droit d'utiliser le type de véhicule (authorization accordée).
 * À utiliser après requireAuth. Utilise vehicleTypeId dans req.body, req.params ou véhicule chargé.
 */
export async function canUseVehicleType(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
  if (req.user.role === 0 || req.user.role === 1) return next(); // admin ou gestionnaire

  const vehicleTypeId = req.body?.vehicleTypeId || req.params?.vehicleTypeId;
  let resolved = vehicleTypeId;
  if (!resolved && req.vehicle) {
    resolved = req.vehicle.vehicleTypeId;
  }
  if (!resolved) {
    return res.status(400).json({ error: 'Type de véhicule non précisé' });
  }

  const auth = await prisma.authorization.findFirst({
    where: {
      userId: req.user.id,
      vehicleTypeId: resolved,
      revokedAt: null,
    },
  });
  if (!auth) {
    return res.status(403).json({ error: 'Vous n\'êtes pas autorisé à utiliser ce type de véhicule' });
  }
  if (auth.expiresAt && new Date(auth.expiresAt) < new Date()) {
    return res.status(403).json({ error: 'Droit d\'utilisation expiré' });
  }
  next();
}

/**
 * Charge le véhicule dans req.vehicle et vérifie qu'il appartient au même hôpital que l'utilisateur.
 */
export async function loadVehicle(req, res, next) {
  const vehicleId = req.params.vehicleId || req.params.id;
  if (!vehicleId) return res.status(400).json({ error: 'vehicleId manquant' });
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: { vehicleType: true, hospital: true },
  });
  if (!vehicle) return res.status(404).json({ error: 'Véhicule introuvable' });
  req.vehicle = vehicle;
  if (req.user.role === 0) return next(); // admin : accès à tous les véhicules
  if (vehicle.hospitalId !== req.user.hospitalId) {
    return res.status(403).json({ error: 'Véhicule d\'un autre établissement' });
  }
  next();
}
