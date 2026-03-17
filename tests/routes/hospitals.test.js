import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { mockDb } from '../setup.js';
import { TEST_BEARER_TOKEN } from '../lib/auth-helper.js';

describe('GET /api/hospitals', () => {
  it('retourne 401 sans token', async () => {
    const res = await request(app).get('/api/hospitals');
    expect(res.status).toBe(401);
  });

  it('retourne la liste des hôpitaux', async () => {
    mockDb.hospital.findMany.mockResolvedValueOnce([
      { id: 'h1', name: 'CHU Test', address: '1 rue Test', createdAt: new Date() },
    ]);
    const res = await request(app)
      .get('/api/hospitals')
      .set('Authorization', TEST_BEARER_TOKEN);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/hospitals/:id', () => {
  it('retourne 404 si introuvable', async () => {
    mockDb.hospital.findUnique.mockResolvedValueOnce(null);
    const res = await request(app)
      .get('/api/hospitals/invalid-id')
      .set('Authorization', TEST_BEARER_TOKEN);
    expect(res.status).toBe(404);
  });

  it('retourne l\'hôpital avec véhicules et utilisateurs', async () => {
    mockDb.hospital.findUnique.mockResolvedValueOnce({
      id: 'hosp-1',
      name: 'CHU Test',
      address: '1 rue Test',
      vehicles: [],
      users: [],
    });
    const res = await request(app)
      .get('/api/hospitals/hosp-1')
      .set('Authorization', TEST_BEARER_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('CHU Test');
  });
});

describe('POST /api/hospitals', () => {
  it('crée un hôpital (gestionnaire)', async () => {
    mockDb.hospital.create.mockResolvedValueOnce({
      id: 'h2',
      name: 'Nouvel Hôpital',
      address: '2 rue Nouvelle',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await request(app)
      .post('/api/hospitals')
      .set('Authorization', TEST_BEARER_TOKEN)
      .send({ name: 'Nouvel Hôpital', address: '2 rue Nouvelle' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Nouvel Hôpital');
  });
});

describe('PATCH /api/hospitals/:id', () => {
  it('met à jour un hôpital', async () => {
    mockDb.hospital.findUnique.mockResolvedValueOnce({
      id: 'hosp-1',
      name: 'CHU Test',
      hospitalId: 'hosp-1',
    });
    mockDb.hospital.update.mockResolvedValueOnce({
      id: 'hosp-1',
      name: 'CHU Test Modifié',
      address: '1 rue Test',
    });
    const res = await request(app)
      .patch('/api/hospitals/hosp-1')
      .set('Authorization', TEST_BEARER_TOKEN)
      .send({ name: 'CHU Test Modifié' });
    expect(res.status).toBe(200);
  });
});
