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

describe('POST /api/auth/refresh', () => {
  it('retourne 503 si FIREBASE_WEB_API_KEY non configuré', async () => {
    const prev = process.env.FIREBASE_WEB_API_KEY;
    delete process.env.FIREBASE_WEB_API_KEY;
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'fake-refresh-token' });
    if (prev) process.env.FIREBASE_WEB_API_KEY = prev;
    expect(res.status).toBe(503);
    expect(res.body.error).toContain('FIREBASE_WEB_API_KEY');
  });

  it('retourne 400 si refreshToken manquant', async () => {
    process.env.FIREBASE_WEB_API_KEY = 'AIzaSyFakeKey';
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(400);
  });

  it('retourne 200 avec nouveaux tokens si refresh valide', async () => {
    process.env.FIREBASE_WEB_API_KEY = 'AIzaSyFakeKeyForTest';
    mockDb.user.findUnique.mockResolvedValueOnce({
      id: 'test-uid-123',
      isDeactivated: false,
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id_token: 'new-id-token',
          refresh_token: 'new-refresh-token',
          expires_in: '3600',
          user_id: 'test-uid-123',
        }),
    });

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'old-refresh-token' });

    fetchMock.mockRestore();

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      idToken: 'new-id-token',
      refreshToken: 'new-refresh-token',
      expiresIn: '3600',
      localId: 'test-uid-123',
    });
  });

  it('retourne 401 si compte désactivé', async () => {
    process.env.FIREBASE_WEB_API_KEY = 'AIzaSyFakeKeyForTest';
    mockDb.user.findUnique.mockResolvedValueOnce({
      id: 'test-uid-123',
      isDeactivated: true,
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id_token: 'new-id-token',
          refresh_token: 'new-refresh-token',
          expires_in: '3600',
          user_id: 'test-uid-123',
        }),
    });

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'old-refresh-token' });

    fetchMock.mockRestore();

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('désactivé');
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

  it('crée le compte et retourne 201 avec le même format que login', async () => {
    mockDb.user.create.mockResolvedValueOnce({
      id: 'new-uid-789',
      email: 'nouveau@example.com',
      firstName: 'Marie',
      lastName: 'Martin',
      role: 0,
      hospitalId: null,
    });

    const prevKey = process.env.FIREBASE_WEB_API_KEY;
    process.env.FIREBASE_WEB_API_KEY = 'AIzaSyFakeKeyForTest';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          idToken: 'fake-id-token',
          refreshToken: 'fake-refresh-token',
          expiresIn: '3600',
          localId: 'new-uid-789',
        }),
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'nouveau@example.com',
        password: 'password123',
        firstName: 'Marie',
        lastName: 'Martin',
      });

    fetchMock.mockRestore();
    if (prevKey) process.env.FIREBASE_WEB_API_KEY = prevKey;

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      idToken: 'fake-id-token',
      refreshToken: 'fake-refresh-token',
      expiresIn: '3600',
      localId: 'new-uid-789',
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
    expect(res.body.role).toBe(2);
  });
});
