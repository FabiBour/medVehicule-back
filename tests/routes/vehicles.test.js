import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { mockDb } from '../setup.js';
import { TEST_BEARER_TOKEN } from '../lib/auth-helper.js';

describe('GET /api/vehicles', () => {
  it('retourne 401 sans token', async () => {
    const res = await request(app).get('/api/vehicles');
    expect(res.status).toBe(401);
  });

  it('retourne la liste des véhicules', async () => {
    mockDb.vehicle.findMany.mockResolvedValueOnce([
      {
        id: 'v1',
        hospitalId: 'hosp-1',
        vehicleTypeId: 'vt1',
        registration: 'AB-123-CD',
        vehicleType: { id: 'vt1', name: 'Voiture' },
        hospital: { id: 'hosp-1', name: 'CHU Test' },
      },
    ]);
    const res = await request(app)
      .get('/api/vehicles')
      .set('Authorization', TEST_BEARER_TOKEN);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/vehicles/:vehicleId', () => {
  it('retourne 404 si véhicule introuvable', async () => {
    mockDb.vehicle.findUnique.mockResolvedValueOnce(null);
    const res = await request(app)
      .get('/api/vehicles/invalid-id')
      .set('Authorization', TEST_BEARER_TOKEN);
    expect(res.status).toBe(404);
  });

  it('retourne le véhicule avec détails', async () => {
    const vehicle = {
      id: 'v1',
      hospitalId: 'hosp-1',
      vehicleTypeId: 'vt1',
      registration: 'AB-123-CD',
      vehicleType: { id: 'vt1', name: 'Voiture' },
      hospital: { id: 'hosp-1', name: 'CHU Test' },
      photos: [],
      model3D: null,
      maintenances: [],
      maintenanceContracts: [],
    };
    mockDb.vehicle.findUnique.mockResolvedValue(vehicle);
    const res = await request(app)
      .get('/api/vehicles/v1')
      .set('Authorization', TEST_BEARER_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.registration).toBe('AB-123-CD');
  });
});

describe('POST /api/vehicles', () => {
  it('crée un véhicule', async () => {
    mockDb.vehicle.create.mockResolvedValueOnce({
      id: 'v2',
      hospitalId: 'hosp-1',
      vehicleTypeId: 'vt1',
      registration: 'CD-456-EF',
      brand: 'Renault',
      model: 'Espace',
      year: 2023,
      vehicleType: { id: 'vt1', name: 'Voiture' },
      hospital: { id: 'hosp-1', name: 'CHU Test' },
    });
    const res = await request(app)
      .post('/api/vehicles')
      .set('Authorization', TEST_BEARER_TOKEN)
      .send({
        hospitalId: 'hosp-1',
        vehicleTypeId: 'vt1',
        registration: 'CD-456-EF',
        brand: 'Renault',
        model: 'Espace',
        year: 2023,
      });
    expect(res.status).toBe(201);
    expect(res.body.registration).toBe('CD-456-EF');
  });
});
