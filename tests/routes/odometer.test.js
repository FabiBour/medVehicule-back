import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { mockDb } from '../setup.js';
import { TEST_BEARER_TOKEN } from '../lib/auth-helper.js';

describe('GET /api/odometer/vehicle/:vehicleId', () => {
  it('retourne 401 sans token', async () => {
    const res = await request(app).get('/api/odometer/vehicle/v1');
    expect(res.status).toBe(401);
  });

  it('retourne les relevés de compteur', async () => {
    mockDb.vehicle.findUnique.mockResolvedValueOnce({
      id: 'v1',
      hospitalId: 'hosp-1',
      vehicleType: {},
      hospital: {},
    });
    mockDb.odometerReading.findMany.mockResolvedValueOnce([
      {
        id: 'o1',
        vehicleId: 'v1',
        userId: 'test-uid-123',
        value: 50000,
        user: { id: 'test-uid-123', firstName: 'Test', lastName: 'User' },
      },
    ]);
    const res = await request(app)
      .get('/api/odometer/vehicle/v1')
      .set('Authorization', TEST_BEARER_TOKEN);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
