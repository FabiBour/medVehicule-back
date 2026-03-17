import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { mockDb } from '../setup.js';
import { TEST_BEARER_TOKEN } from '../lib/auth-helper.js';

describe('GET /api/vehicle3d/vehicle/:vehicleId', () => {
  it('retourne 401 sans token', async () => {
    const res = await request(app).get('/api/vehicle3d/vehicle/v1');
    expect(res.status).toBe(401);
  });

  it('retourne 404 si pas de modèle 3D', async () => {
    mockDb.vehicle.findUnique.mockResolvedValueOnce({
      id: 'v1',
      hospitalId: 'hosp-1',
      vehicleType: {},
      hospital: {},
    });
    mockDb.vehicle3D.findUnique.mockResolvedValueOnce(null);
    const res = await request(app)
      .get('/api/vehicle3d/vehicle/v1')
      .set('Authorization', TEST_BEARER_TOKEN);
    expect(res.status).toBe(404);
  });

  it('retourne le modèle 3D', async () => {
    mockDb.vehicle.findUnique.mockResolvedValueOnce({
      id: 'v1',
      hospitalId: 'hosp-1',
      vehicleType: {},
      hospital: {},
    });
    mockDb.vehicle3D.findUnique.mockResolvedValueOnce({
      id: 'v1',
      vehicleId: 'v1',
      format: 'glb',
      url: 'models3d/test.glb',
    });
    const res = await request(app)
      .get('/api/vehicle3d/vehicle/v1')
      .set('Authorization', TEST_BEARER_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.format).toBe('glb');
  });
});
