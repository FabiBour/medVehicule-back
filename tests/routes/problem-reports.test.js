import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { mockDb } from '../setup.js';
import { TEST_BEARER_TOKEN } from '../lib/auth-helper.js';

describe('GET /api/problem-reports', () => {
  it('retourne 401 sans token', async () => {
    const res = await request(app).get('/api/problem-reports');
    expect(res.status).toBe(401);
  });

  it('retourne la liste des signalements', async () => {
    mockDb.vehicle.findMany.mockResolvedValueOnce([{ id: 'v1' }]);
    mockDb.problemReport.findMany.mockResolvedValueOnce([
      {
        id: 'pr1',
        vehicleId: 'v1',
        userId: 'test-uid-123',
        type: 'rayure',
        status: 'ouvert',
        vehicle: { id: 'v1', registration: 'AB-123', vehicleType: { name: 'Voiture' } },
        user: { id: 'test-uid-123', firstName: 'Test', lastName: 'User' },
      },
    ]);
    const res = await request(app)
      .get('/api/problem-reports')
      .set('Authorization', TEST_BEARER_TOKEN);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
