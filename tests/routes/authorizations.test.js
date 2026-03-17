import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { mockDb } from '../setup.js';
import { TEST_BEARER_TOKEN } from '../lib/auth-helper.js';

describe('GET /api/authorizations', () => {
  it('retourne 401 sans token', async () => {
    const res = await request(app).get('/api/authorizations');
    expect(res.status).toBe(401);
  });

  it('retourne la liste des autorisations', async () => {
    mockDb.authorization.findMany.mockResolvedValueOnce([
      {
        id: 'auth1',
        userId: 'user1',
        vehicleTypeId: 'vt1',
        user: { id: 'user1', email: 'user@test.fr' },
        vehicleType: { id: 'vt1', name: 'Voiture' },
      },
    ]);
    const res = await request(app)
      .get('/api/authorizations')
      .set('Authorization', TEST_BEARER_TOKEN);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
