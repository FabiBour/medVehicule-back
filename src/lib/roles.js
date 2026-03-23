/**
 * Rôles utilisateur
 * 0 = usager, 1 = gestionnaire, 2 = admin, 3 = super_admin
 */
export const ROLE_USAGER = 0;
export const ROLE_GESTIONNAIRE = 1;
export const ROLE_ADMIN = 2;
export const ROLE_SUPER_ADMIN = 3;

export const ROLES = {
  [ROLE_USAGER]: 'usager',
  [ROLE_GESTIONNAIRE]: 'gestionnaire',
  [ROLE_ADMIN]: 'admin',
  [ROLE_SUPER_ADMIN]: 'super_admin',
};

export function isAdmin(role) {
  return role === ROLE_ADMIN;
}

export function isSuperAdmin(role) {
  return role === ROLE_SUPER_ADMIN;
}

export function isGestionnaireOrAdmin(role) {
  return role === ROLE_ADMIN || role === ROLE_GESTIONNAIRE;
}

export function canModifyRoles(role) {
  return role === ROLE_ADMIN;
}

/** Super admin : gestion des hôpitaux et affectation des usagers/gestionnaires */
export function canManageHospitals(role) {
  return role === ROLE_SUPER_ADMIN;
}

export function canAssignUserToHospitals(role) {
  return role === ROLE_SUPER_ADMIN;
}
