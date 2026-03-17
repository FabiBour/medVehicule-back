import { describe, it, expect, vi } from 'vitest';
import { requireAuth, requireGestionnaire, requireAdmin } from '../../src/middleware/auth.js';

describe('middleware/auth', () => {
  describe('requireGestionnaire', () => {
    it('passe pour role 0 (admin)', () => {
      const req = { user: { role: 0 } };
      const res = {};
      const next = vi.fn();
      requireGestionnaire(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('passe pour role 1 (gestionnaire)', () => {
      const req = { user: { role: 1 } };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();
      requireGestionnaire(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('retourne 403 pour role 2 (usager)', () => {
      const req = { user: { role: 2 } };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();
      requireGestionnaire(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireAdmin', () => {
    it('passe pour role 0 (admin)', () => {
      const req = { user: { role: 0 } };
      const res = {};
      const next = vi.fn();
      requireAdmin(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('retourne 403 pour role 1 (gestionnaire)', () => {
      const req = { user: { role: 1 } };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();
      requireAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('retourne 403 pour role 2 (usager)', () => {
      const req = { user: { role: 2 } };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();
      requireAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
