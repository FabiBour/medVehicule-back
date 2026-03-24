import { prisma } from '../db.js';

/**
 * IDs d'hôpitaux dans l'ordre (hospitalIds prioritaire, sinon hospitalId).
 */
export function getOrderedHospitalIds(user) {
  if (Array.isArray(user.hospitalIds) && user.hospitalIds.length > 0) {
    return [...new Set(user.hospitalIds)];
  }
  if (user.hospitalId) {
    return [user.hospitalId];
  }
  return [];
}

/**
 * Hôpital pour les réponses API (sans champs internes Firestore).
 */
export function serializeHospital(h) {
  if (!h) return null;
  const createdAt = h.createdAt;
  const created =
    createdAt instanceof Date
      ? createdAt.toISOString()
      : createdAt?.toDate?.()
        ? createdAt.toDate().toISOString()
        : createdAt ?? null;
  return {
    id: h.id,
    name: h.name,
    address: h.address ?? null,
    createdAt: created,
  };
}

/**
 * Liste des hôpitaux affectés à l'utilisateur (objets complets).
 */
export async function resolveUserHospitals(user) {
  const ids = getOrderedHospitalIds(user);
  const hospitals = [];
  for (const id of ids) {
    const h = await prisma.hospital.findUnique({ where: { id } });
    if (h) hospitals.push(serializeHospital(h));
  }
  return hospitals;
}

/**
 * Utilisateur embarqué (réservations, autorisations, etc.) : hospitals uniquement.
 */
export async function formatEmbeddedUser(user) {
  if (!user) return null;
  const u = (await prisma.user.findUnique({ where: { id: user.id } })) || user;
  const hospitals = await resolveUserHospitals(u);
  return {
    id: u.id,
    ...(u.email != null && { email: u.email }),
    firstName: u.firstName,
    lastName: u.lastName,
    ...(u.role != null && { role: u.role }),
    hospitals,
  };
}

/**
 * Véhicule : `hospitals` à la place de `hospital` / `hospitalId`.
 */
export function serializeVehicleForApi(vehicle) {
  if (!vehicle) return vehicle;
  const { hospital, hospitalId: _hid, ...rest } = vehicle;
  const hospitals = hospital ? [serializeHospital(hospital)] : [];
  return { ...rest, hospitals };
}

/**
 * Réservation avec user et véhicule au format API.
 */
export async function mapBookingWithPublicUser(b) {
  if (!b) return b;
  const out = { ...b };
  if (out.user) out.user = await formatEmbeddedUser(out.user);
  if (out.vehicle) out.vehicle = serializeVehicleForApi(out.vehicle);
  return out;
}

/**
 * Autorisation avec user public.
 */
export async function mapAuthorizationWithPublicUser(row) {
  if (!row) return row;
  const out = { ...row };
  if (out.user) out.user = await formatEmbeddedUser(out.user);
  return out;
}

/**
 * Signalement / relevé avec user (et véhicule si présent).
 */
export async function mapProblemReportWithPublicUser(r) {
  if (!r) return r;
  const out = { ...r };
  if (out.user) out.user = await formatEmbeddedUser(out.user);
  if (out.vehicle) out.vehicle = serializeVehicleForApi(out.vehicle);
  return out;
}

export async function mapOdometerReadingWithPublicUser(r) {
  if (!r) return r;
  return { ...r, user: await formatEmbeddedUser(r.user) };
}

/**
 * Demande d'intervention avec createdBy et véhicule.
 */
export async function mapInterventionWithPublicUser(row) {
  if (!row) return row;
  const out = { ...row };
  if (out.createdBy) out.createdBy = await formatEmbeddedUser(out.createdBy);
  if (out.assignedTo) out.assignedTo = await formatEmbeddedUser(out.assignedTo);
  if (out.vehicle) out.vehicle = serializeVehicleForApi(out.vehicle);
  return out;
}

/**
 * Utilisateur pour les réponses API : hospitals à la place de hospitalId / hospitalIds / hospital.
 */
export async function toPublicUser(user, options = {}) {
  const {
    includeCreatedAt = false,
    includeUpdatedAt = false,
    includeDeactivated = false,
  } = options;

  const hospitals = await resolveUserHospitals(user);
  const out = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    hospitals,
  };

  if (includeCreatedAt && user.createdAt != null) out.createdAt = user.createdAt;
  if (includeUpdatedAt && user.updatedAt != null) out.updatedAt = user.updatedAt;
  if (includeDeactivated) out.isDeactivated = user.isDeactivated === true;

  return out;
}
