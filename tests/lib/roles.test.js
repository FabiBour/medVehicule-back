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
    it('ROLE_USAGER vaut 0', () => {
      expect(ROLE_USAGER).toBe(0);
    });
    it('ROLE_GESTIONNAIRE vaut 1', () => {
      expect(ROLE_GESTIONNAIRE).toBe(1);
    });
    it('ROLE_ADMIN vaut 2', () => {
      expect(ROLE_ADMIN).toBe(2);
    });
    it('ROLES mappe les valeurs aux noms', () => {
      expect(ROLES[0]).toBe('usager');
      expect(ROLES[1]).toBe('gestionnaire');
      expect(ROLES[2]).toBe('admin');
    });
  });

  describe('isAdmin', () => {
    it('retourne true pour role 2', () => {
      expect(isAdmin(2)).toBe(true);
    });
    it('retourne false pour role 0 et 1', () => {
      expect(isAdmin(0)).toBe(false);
      expect(isAdmin(1)).toBe(false);
    });
  });

  describe('isGestionnaireOrAdmin', () => {
    it('retourne true pour role 1 et 2', () => {
      expect(isGestionnaireOrAdmin(1)).toBe(true);
      expect(isGestionnaireOrAdmin(2)).toBe(true);
    });
    it('retourne false pour role 0', () => {
      expect(isGestionnaireOrAdmin(0)).toBe(false);
    });
  });

  describe('canModifyRoles', () => {
    it('retourne true uniquement pour admin (2)', () => {
      expect(canModifyRoles(2)).toBe(true);
      expect(canModifyRoles(0)).toBe(false);
      expect(canModifyRoles(1)).toBe(false);
    });
  });
});
