import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { mockDb } from '../setup.js';
import { TEST_BEARER_TOKEN } from '../lib/auth-helper.js';

describe('GET /api/maintenance', () => {
  it('retourne 401 sans token', async () => {
    const res = await request(app).get('/api/maintenance');
    expect(res.status).toBe(401);
  });

  it('retourne la liste des maintenances', async () => {
    mockDb.vehicle.findMany.mockResolvedValueOnce([{ id: 'v1' }]);
    mockDb.maintenance.findMany.mockResolvedValueOnce([
      {
        id: 'm1',
        vehicleId: 'v1',
        type: 'controle_technique',
        status: 'planifie',
        vehicle: { id: 'v1', vehicleType: { name: 'Voiture' } },
        garage: null,
        contract: null,
      },
    ]);
    const res = await request(app)
      .get('/api/maintenance')
      .set('Authorization', TEST_BEARER_TOKEN);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/maintenance/garages/list', () => {
  it('retourne la liste des garages', async () => {
    mockDb.partnerGarage.findMany.mockResolvedValueOnce([
      { id: 'g1', name: 'Garage Central', hospitalId: 'hosp-1' },
    ]);
    const res = await request(app)
      .get('/api/maintenance/garages/list')
      .set('Authorization', TEST_BEARER_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Garage Central');
  });
});
