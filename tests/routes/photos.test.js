import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { mockDb } from '../setup.js';
import { TEST_BEARER_TOKEN } from '../lib/auth-helper.js';

describe('GET /api/photos/vehicle/:vehicleId', () => {
  it('retourne 401 sans token', async () => {
    const res = await request(app).get('/api/photos/vehicle/v1');
    expect(res.status).toBe(401);
  });

  it('retourne la liste des photos', async () => {
    mockDb.vehicle.findUnique.mockResolvedValue({
      id: 'v1',
      hospitalId: 'hosp-1',
      vehicleType: {},
      hospital: {},
    });
    mockDb.vehiclePhoto.findMany.mockResolvedValueOnce([
      {
        id: 'p1',
        vehicleId: 'v1',
        url: 'photos/test.jpg',
        label: 'avant_prise',
        takenAt: new Date(),
      },
    ]);
    const res = await request(app)
      .get('/api/photos/vehicle/v1')
      .set('Authorization', TEST_BEARER_TOKEN);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
