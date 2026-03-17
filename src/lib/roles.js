/**
 * Rôles utilisateur
 * 0 = admin, 1 = gestionnaire, 2 = usager
 */
export const ROLE_ADMIN = 0;
export const ROLE_GESTIONNAIRE = 1;
export const ROLE_USAGER = 2;

export const ROLES = {
  [ROLE_ADMIN]: 'admin',
  [ROLE_GESTIONNAIRE]: 'gestionnaire',
  [ROLE_USAGER]: 'usager',
};

export function isAdmin(role) {
  return role === ROLE_ADMIN;
}

export function isGestionnaireOrAdmin(role) {
  return role === ROLE_ADMIN || role === ROLE_GESTIONNAIRE;
}

export function canModifyRoles(role) {
  return role === ROLE_ADMIN;
}
