import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { mockDb, verifyIdTokenMock } from '../setup.js';
import { TEST_BEARER_TOKEN } from '../lib/auth-helper.js';

describe('POST /api/auth/register-profil', () => {
  beforeEach(() => {
    verifyIdTokenMock.mockResolvedValue({
      uid: 'test-uid-123',
      email: 'test@example.com',
    });
    mockDb.store.users = mockDb.store.users.filter((u) => u.id === 'test-uid-123');
  });

  it('retourne 401 sans token', async () => {
    const res = await request(app)
      .post('/api/auth/register-profil')
      .send({ firstName: 'Jean', lastName: 'Dupont' });
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Token');
  });

  it('retourne 400 si body invalide', async () => {
    const res = await request(app)
      .post('/api/auth/register-profil')
      .set('Authorization', TEST_BEARER_TOKEN)
      .send({ lastName: 'Dupont' });
    expect(res.status).toBe(400);
  });

  it('retourne 409 si profil déjà créé', async () => {
    const res = await request(app)
      .post('/api/auth/register-profil')
      .set('Authorization', TEST_BEARER_TOKEN)
      .send({ firstName: 'Jean', lastName: 'Dupont' });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('déjà');
  });

  it('crée le profil et retourne 201 pour nouvel utilisateur', async () => {
    verifyIdTokenMock.mockResolvedValueOnce({
      uid: 'new-uid-456',
      email: 'nouveau@example.com',
    });
    mockDb.user.create.mockResolvedValueOnce({
      id: 'new-uid-456',
      email: 'nouveau@example.com',
      firstName: 'Jean',
      lastName: 'Dupont',
      role: 2,
      hospitalId: null,
    });
    mockDb.hospital.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/register-profil')
      .set('Authorization', TEST_BEARER_TOKEN)
      .send({ firstName: 'Jean', lastName: 'Dupont' });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe(2);
    expect(res.body.firstName).toBe('Jean');
    expect(res.body.lastName).toBe('Dupont');
  });
});

describe('GET /api/auth/me', () => {
  it('retourne 401 sans token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('retourne le profil utilisateur avec token valide', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', TEST_BEARER_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('test@example.com');
    expect(res.body.role).toBe(0);
  });
});
