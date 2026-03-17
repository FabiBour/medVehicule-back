import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { mockDb } from '../setup.js';
import { TEST_BEARER_TOKEN } from '../lib/auth-helper.js';

describe('GET /api/interventions', () => {
  it('retourne 401 sans token', async () => {
    const res = await request(app).get('/api/interventions');
    expect(res.status).toBe(401);
  });

  it('retourne la liste des demandes d\'intervention', async () => {
    mockDb.interventionRequest.findMany.mockResolvedValueOnce([
      {
        id: 'i1',
        vehicleId: 'v1',
        createdById: 'test-uid-123',
        title: 'Problème',
        status: 'nouvelle',
        vehicle: { id: 'v1', hospitalId: 'hosp-1', vehicleType: { name: 'Voiture' } },
        createdBy: { id: 'test-uid-123', firstName: 'Test', lastName: 'User' },
        statusHistory: [],
      },
    ]);
    const res = await request(app)
      .get('/api/interventions')
      .set('Authorization', TEST_BEARER_TOKEN);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /api/interventions', () => {
  it('crée une demande d\'intervention', async () => {
    mockDb.vehicle.findUnique.mockResolvedValueOnce({
      id: 'v1',
      hospitalId: 'hosp-1',
    });
    mockDb.interventionRequest.create.mockResolvedValueOnce({
      id: 'i2',
      vehicleId: 'v1',
      createdById: 'test-uid-123',
      title: 'Nouvelle demande',
      status: 'nouvelle',
      vehicle: { id: 'v1', vehicleType: { name: 'Voiture' } },
      createdBy: { id: 'test-uid-123', firstName: 'Test', lastName: 'User' },
      statusHistory: [],
    });
    mockDb.interventionStatusHistory.create.mockResolvedValueOnce({});
    mockDb.interventionRequest.findUnique.mockResolvedValueOnce({
      id: 'i2',
      vehicleId: 'v1',
      title: 'Nouvelle demande',
      status: 'nouvelle',
      statusHistory: [{ status: 'nouvelle', comment: 'Demande créée' }],
    });
    const res = await request(app)
      .post('/api/interventions')
      .set('Authorization', TEST_BEARER_TOKEN)
      .send({
        vehicleId: 'v1',
        title: 'Nouvelle demande',
        description: 'Description',
      });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Nouvelle demande');
  });
});
