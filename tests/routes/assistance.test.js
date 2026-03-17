import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { mockDb } from '../setup.js';
import { TEST_BEARER_TOKEN } from '../lib/auth-helper.js';

describe('GET /api/assistance', () => {
  it('retourne 401 sans token', async () => {
    const res = await request(app).get('/api/assistance');
    expect(res.status).toBe(401);
  });

  it('retourne la liste des demandes d\'assistance', async () => {
    mockDb.vehicle.findMany.mockResolvedValueOnce([{ id: 'v1' }]);
    mockDb.assistanceRequest.findMany.mockResolvedValueOnce([
      {
        id: 'a1',
        vehicleId: 'v1',
        type: 'panne',
        status: 'ouverte',
        vehicle: { id: 'v1', vehicleType: { name: 'Voiture' } },
      },
    ]);
    const res = await request(app)
      .get('/api/assistance')
      .set('Authorization', TEST_BEARER_TOKEN);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /api/assistance', () => {
  it('crée une demande d\'assistance', async () => {
    mockDb.vehicle.findUnique.mockResolvedValueOnce({
      id: 'v1',
      hospitalId: 'hosp-1',
    });
    mockDb.assistanceRequest.create.mockResolvedValueOnce({
      id: 'a2',
      vehicleId: 'v1',
      type: 'depannage',
      status: 'ouverte',
      vehicle: { id: 'v1', vehicleType: { name: 'Voiture' } },
    });
    const res = await request(app)
      .post('/api/assistance')
      .set('Authorization', TEST_BEARER_TOKEN)
      .send({
        vehicleId: 'v1',
        type: 'depannage',
        description: 'Panne moteur',
      });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('depannage');
  });
});
