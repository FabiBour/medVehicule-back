import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { mockDb } from '../setup.js';
import { TEST_BEARER_TOKEN } from '../lib/auth-helper.js';

describe('GET /api/bookings', () => {
  it('retourne 401 sans token', async () => {
    const res = await request(app).get('/api/bookings');
    expect(res.status).toBe(401);
  });

  it('retourne la liste des réservations', async () => {
    mockDb.booking.findMany.mockResolvedValueOnce([
      {
        id: 'b1',
        vehicleId: 'v1',
        userId: 'test-uid-123',
        startDate: new Date(),
        status: 'planned',
        vehicle: { id: 'v1', vehicleType: { name: 'Voiture' }, hospital: { name: 'CHU' } },
        user: { id: 'test-uid-123', firstName: 'Test', lastName: 'User' },
      },
    ]);
    const res = await request(app)
      .get('/api/bookings')
      .set('Authorization', TEST_BEARER_TOKEN);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /api/bookings', () => {
  it('crée une réservation', async () => {
    mockDb.vehicle.findUnique.mockResolvedValueOnce({
      id: 'v1',
      hospitalId: 'hosp-1',
      vehicleTypeId: 'vt1',
      vehicleType: { id: 'vt1' },
      hospital: { id: 'hosp-1' },
    });
    mockDb.authorization.findFirst.mockResolvedValueOnce({ id: 'auth1' });
    mockDb.booking.create.mockResolvedValueOnce({
      id: 'b2',
      vehicleId: 'v1',
      userId: 'test-uid-123',
      startDate: new Date(),
      status: 'planned',
      vehicle: { id: 'v1', vehicleType: { name: 'Voiture' } },
      user: { id: 'test-uid-123', firstName: 'Test', lastName: 'User' },
    });
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', TEST_BEARER_TOKEN)
      .send({
        vehicleId: 'v1',
        startDate: new Date().toISOString(),
        notes: 'Test',
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('planned');
  });
});
