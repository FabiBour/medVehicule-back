import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { mockDb } from '../setup.js';
import { TEST_BEARER_TOKEN } from '../lib/auth-helper.js';

describe('GET /api/vehicle-types', () => {
  it('retourne 401 sans token', async () => {
    const res = await request(app).get('/api/vehicle-types');
    expect(res.status).toBe(401);
  });

  it('retourne la liste des types de véhicules', async () => {
    mockDb.vehicleType.findMany.mockResolvedValueOnce([
      { id: 'vt1', name: 'Voiture', description: 'Véhicule léger' },
      { id: 'vt2', name: 'Ambulance', description: 'Véhicule sanitaire' },
    ]);
    const res = await request(app)
      .get('/api/vehicle-types')
      .set('Authorization', TEST_BEARER_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0].name).toBe('Voiture');
  });
});

describe('GET /api/vehicle-types/:id', () => {
  it('retourne 404 si introuvable', async () => {
    mockDb.vehicleType.findUnique.mockResolvedValueOnce(null);
    const res = await request(app)
      .get('/api/vehicle-types/invalid-id')
      .set('Authorization', TEST_BEARER_TOKEN);
    expect(res.status).toBe(404);
  });

  it('retourne le type avec véhicules', async () => {
    mockDb.vehicleType.findUnique.mockResolvedValueOnce({
      id: 'vt1',
      name: 'Voiture',
      description: 'Véhicule léger',
      vehicles: [],
    });
    const res = await request(app)
      .get('/api/vehicle-types/vt1')
      .set('Authorization', TEST_BEARER_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Voiture');
  });
});

describe('POST /api/vehicle-types', () => {
  it('crée un type de véhicule', async () => {
    mockDb.vehicleType.create.mockResolvedValueOnce({
      id: 'vt3',
      name: 'Hélicoptère',
      description: 'SMUR',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await request(app)
      .post('/api/vehicle-types')
      .set('Authorization', TEST_BEARER_TOKEN)
      .send({ name: 'Hélicoptère', description: 'SMUR' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Hélicoptère');
  });
});
