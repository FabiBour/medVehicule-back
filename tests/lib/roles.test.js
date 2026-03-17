import { describe, it, expect } from 'vitest';
import {
  ROLE_ADMIN,
  ROLE_GESTIONNAIRE,
  ROLE_USAGER,
  ROLES,
  isAdmin,
  isGestionnaireOrAdmin,
  canModifyRoles,
} from '../../src/lib/roles.js';

describe('lib/roles', () => {
  describe('constantes', () => {
    it('ROLE_ADMIN vaut 0', () => {
      expect(ROLE_ADMIN).toBe(0);
    });
    it('ROLE_GESTIONNAIRE vaut 1', () => {
      expect(ROLE_GESTIONNAIRE).toBe(1);
    });
    it('ROLE_USAGER vaut 2', () => {
      expect(ROLE_USAGER).toBe(2);
    });
    it('ROLES mappe les valeurs aux noms', () => {
      expect(ROLES[0]).toBe('admin');
      expect(ROLES[1]).toBe('gestionnaire');
      expect(ROLES[2]).toBe('usager');
    });
  });

  describe('isAdmin', () => {
    it('retourne true pour role 0', () => {
      expect(isAdmin(0)).toBe(true);
    });
    it('retourne false pour role 1 et 2', () => {
      expect(isAdmin(1)).toBe(false);
      expect(isAdmin(2)).toBe(false);
    });
  });

  describe('isGestionnaireOrAdmin', () => {
    it('retourne true pour role 0 et 1', () => {
      expect(isGestionnaireOrAdmin(0)).toBe(true);
      expect(isGestionnaireOrAdmin(1)).toBe(true);
    });
    it('retourne false pour role 2', () => {
      expect(isGestionnaireOrAdmin(2)).toBe(false);
    });
  });

  describe('canModifyRoles', () => {
    it('retourne true uniquement pour admin (0)', () => {
      expect(canModifyRoles(0)).toBe(true);
      expect(canModifyRoles(1)).toBe(false);
      expect(canModifyRoles(2)).toBe(false);
    });
  });
});
