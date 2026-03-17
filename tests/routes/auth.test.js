import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { mockDb, verifyIdTokenMock, createUserMock } from '../setup.js';
import { TEST_BEARER_TOKEN } from '../lib/auth-helper.js';

describe('POST /api/auth/login', () => {
  it('retourne 503 si FIREBASE_WEB_API_KEY non configuré', async () => {
    const prev = process.env.FIREBASE_WEB_API_KEY;
    delete process.env.FIREBASE_WEB_API_KEY;
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    if (prev) process.env.FIREBASE_WEB_API_KEY = prev;
    expect(res.status).toBe(503);
    expect(res.body.error).toContain('FIREBASE_WEB_API_KEY');
  });

  it('retourne 400 si body invalide', async () => {
    process.env.FIREBASE_WEB_API_KEY = 'fake-key';
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'invalid', password: '' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    createUserMock.mockResolvedValue({ uid: 'new-uid-789', email: 'nouveau@example.com' });
    mockDb.user.findUnique.mockResolvedValueOnce(null);
    mockDb.hospital.findUnique.mockResolvedValueOnce(null);
  });

  it('retourne 400 si body invalide', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com', password: '123', firstName: 'Jean' });
    expect(res.status).toBe(400);
  });

  it('crée le compte et retourne 201', async () => {
    mockDb.user.create.mockResolvedValueOnce({
      id: 'new-uid-789',
      email: 'nouveau@example.com',
      firstName: 'Marie',
      lastName: 'Martin',
      role: 2,
      hospitalId: null,
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'nouveau@example.com',
        password: 'password123',
        firstName: 'Marie',
        lastName: 'Martin',
      });

    expect(res.status).toBe(201);
    expect(res.body.user || res.body).toMatchObject({
      email: 'nouveau@example.com',
      firstName: 'Marie',
      lastName: 'Martin',
      role: 2,
    });
  });

  it('retourne 409 si email déjà utilisé', async () => {
    createUserMock.mockRejectedValueOnce({ code: 'auth/email-already-exists' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'existant@example.com',
        password: 'password123',
        firstName: 'Jean',
        lastName: 'Dupont',
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('déjà');
  });
});

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    verifyIdTokenMock.mockResolvedValue({
      uid: 'test-uid-123',
      email: 'test@example.com',
    });
    mockDb.user.findUnique.mockReset();
    mockDb.user.findUnique.mockImplementation(({ where }) => {
      const found = mockDb.store.users.find((x) => x.id === where.id);
      return Promise.resolve(found || null);
    });
  });

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
