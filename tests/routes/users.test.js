import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { mockDb } from '../setup.js';
import { TEST_BEARER_TOKEN } from '../lib/auth-helper.js';

describe('GET /api/users', () => {
  it('retourne 401 sans token', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  it('retourne la liste des utilisateurs', async () => {
    mockDb.user.findMany.mockResolvedValueOnce([
      {
        id: 'test-uid-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 2,
        hospitalId: 'hosp-1',
        hospital: { id: 'hosp-1', name: 'CHU Test' },
      },
    ]);
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', TEST_BEARER_TOKEN);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /api/users', () => {
  it('crée un utilisateur (admin)', async () => {
    mockDb.user.findFirst.mockResolvedValueOnce(null);
    mockDb.user.create.mockResolvedValueOnce({
      id: 'new-user-uid',
      email: 'nouveau@chu.fr',
      firstName: 'Marie',
      lastName: 'Nouvelle',
      role: 1,
      hospitalId: 'hosp-1',
      createdAt: new Date(),
    });
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', TEST_BEARER_TOKEN)
      .send({
        hospitalId: 'hosp-1',
        email: 'nouveau@chu.fr',
        password: 'password123',
        firstName: 'Marie',
        lastName: 'Nouvelle',
        role: 1,
      });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe('nouveau@chu.fr');
    expect(res.body.role).toBe(1);
  });
});

describe('PATCH /api/users/:id/role', () => {
  it('modifie le rôle (admin uniquement)', async () => {
    const adminUser = {
      id: 'test-uid-123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 2,
      hospitalId: 'hosp-1',
      hospital: { id: 'hosp-1', name: 'CHU Test' },
    };
    mockDb.user.findUnique
      .mockResolvedValueOnce(adminUser)
      .mockResolvedValueOnce({
        id: 'user-to-update',
        email: 'user@chu.fr',
        role: 0,
      });
    mockDb.user.update.mockResolvedValueOnce({
      id: 'user-to-update',
      email: 'user@chu.fr',
      firstName: 'Jean',
      lastName: 'User',
      role: 1,
      hospitalId: 'hosp-1',
      updatedAt: new Date(),
    });
    const res = await request(app)
      .patch('/api/users/user-to-update/role')
      .set('Authorization', TEST_BEARER_TOKEN)
      .send({ role: 1 });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe(1);
  });
});
