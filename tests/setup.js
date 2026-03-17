import { vi } from 'vitest';

// Mock firebase-admin
const verifyIdTokenMock = vi.fn().mockResolvedValue({
  uid: 'test-uid-123',
  email: 'test@example.com',
});
const createUserMock = vi.fn().mockResolvedValue({
  uid: 'new-user-uid',
  email: 'new@example.com',
});

vi.mock('firebase-admin', () => ({
  default: {
    apps: [],
    auth: vi.fn(() => ({
      verifyIdToken: verifyIdTokenMock,
      createUser: createUserMock,
    })),
    credential: { cert: vi.fn() },
    initializeApp: vi.fn(),
    firestore: vi.fn(),
  },
}));

export { verifyIdTokenMock, createUserMock };

// Mock db (prisma)
const createMockDb = () => {
  const store = {
    hospitals: [],
    vehicleTypes: [],
    vehicles: [],
    users: [],
    bookings: [],
    authorizations: [],
    vehiclePhotos: [],
    problemReports: [],
    odometerReadings: [],
    partnerGarages: [],
    maintenanceContracts: [],
    maintenances: [],
    assistanceRequests: [],
    interventionRequests: [],
    interventionStatusHistory: [],
    vehicle3D: {},
  };

  const mockFindMany = (collection) => vi.fn().mockResolvedValue(store[collection] || []);
  const mockFindUnique = (collection) => vi.fn().mockImplementation(({ where }) => {
    const arr = store[collection];
    if (Array.isArray(arr)) {
      const found = arr.find((x) => x.id === where.id);
      return Promise.resolve(found || null);
    }
    if (typeof arr === 'object') {
      return Promise.resolve(arr[where.vehicleId] || null);
    }
    return Promise.resolve(null);
  });
  const mockFindFirst = (collection) => vi.fn().mockImplementation(({ where }) => {
    const arr = store[collection] || [];
    const found = arr.find((x) => (where.email ? x.email === where.email : x.id === where.id));
    return Promise.resolve(found || null);
  });
  const mockCreate = (collection) => vi.fn().mockImplementation(({ data }) => {
    const id = data.uid || data.id || `mock-${Date.now()}`;
    const doc = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
    if (Array.isArray(store[collection])) {
      store[collection].push(doc);
    }
    return Promise.resolve(doc);
  });
  const mockUpdate = (collection) => vi.fn().mockImplementation(({ where, data }) => {
    const arr = store[collection];
    if (Array.isArray(arr)) {
      const idx = arr.findIndex((x) => x.id === where.id);
      if (idx >= 0) {
        store[collection][idx] = { ...arr[idx], ...data, updatedAt: new Date() };
        return Promise.resolve(store[collection][idx]);
      }
    }
    return Promise.resolve(null);
  });
  const mockDelete = () => vi.fn().mockResolvedValue(undefined);
  const mockDeleteMany = () => vi.fn().mockResolvedValue(undefined);

  return {
    store,
    hospital: {
      findMany: mockFindMany('hospitals'),
      findUnique: mockFindUnique('hospitals'),
      create: mockCreate('hospitals'),
      update: mockUpdate('hospitals'),
    },
    vehicleType: {
      findMany: mockFindMany('vehicleTypes'),
      findUnique: mockFindUnique('vehicleTypes'),
      create: mockCreate('vehicleTypes'),
      update: mockUpdate('vehicleTypes'),
    },
    vehicle: {
      findMany: mockFindMany('vehicles'),
      findUnique: mockFindUnique('vehicles'),
      create: mockCreate('vehicles'),
      update: mockUpdate('vehicles'),
      delete: mockDelete(),
    },
    user: {
      findMany: mockFindMany('users'),
      findFirst: mockFindFirst('users'),
      findUnique: mockFindUnique('users'),
      create: mockCreate('users'),
      update: mockUpdate('users'),
    },
    authorization: {
      findMany: mockFindMany('authorizations'),
      findFirst: mockFindFirst('authorizations'),
      findUnique: mockFindUnique('authorizations'),
      create: mockCreate('authorizations'),
      update: mockUpdate('authorizations'),
    },
    booking: {
      findMany: mockFindMany('bookings'),
      findUnique: mockFindUnique('bookings'),
      create: mockCreate('bookings'),
      update: mockUpdate('bookings'),
    },
    vehiclePhoto: {
      findMany: mockFindMany('vehiclePhotos'),
      findUnique: mockFindUnique('vehiclePhotos'),
      create: mockCreate('vehiclePhotos'),
      delete: mockDelete(),
    },
    problemReport: {
      findMany: mockFindMany('problemReports'),
      findUnique: mockFindUnique('problemReports'),
      create: mockCreate('problemReports'),
      update: mockUpdate('problemReports'),
    },
    odometerReading: {
      findMany: mockFindMany('odometerReadings'),
      create: mockCreate('odometerReadings'),
    },
    partnerGarage: {
      findMany: mockFindMany('partnerGarages'),
      create: mockCreate('partnerGarages'),
    },
    maintenanceContract: {
      findMany: mockFindMany('maintenanceContracts'),
      create: mockCreate('maintenanceContracts'),
    },
    maintenance: {
      findMany: mockFindMany('maintenances'),
      findUnique: mockFindUnique('maintenances'),
      create: mockCreate('maintenances'),
      update: mockUpdate('maintenances'),
    },
    assistanceRequest: {
      findMany: mockFindMany('assistanceRequests'),
      findUnique: mockFindUnique('assistanceRequests'),
      create: mockCreate('assistanceRequests'),
      update: mockUpdate('assistanceRequests'),
    },
    interventionRequest: {
      findMany: mockFindMany('interventionRequests'),
      findUnique: mockFindUnique('interventionRequests'),
      create: mockCreate('interventionRequests'),
      update: mockUpdate('interventionRequests'),
    },
    interventionStatusHistory: {
      create: mockCreate('interventionStatusHistory'),
    },
    vehicle3D: {
      findUnique: mockFindUnique('vehicle3D'),
      create: mockCreate('vehicle3D'),
      update: mockUpdate('vehicle3D'),
      deleteMany: mockDeleteMany(),
    },
  };
};

const mockDb = createMockDb();

// Utilisateur par défaut pour les tests authentifiés (uid du mock Firebase)
mockDb.store.users.push({
  id: 'test-uid-123',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 0,
  hospitalId: 'hosp-1',
  hospital: { id: 'hosp-1', name: 'CHU Test' },
  createdAt: new Date(),
  updatedAt: new Date(),
});
mockDb.store.hospitals.push({
  id: 'hosp-1',
  name: 'CHU Test',
  address: '1 rue Test',
  createdAt: new Date(),
  updatedAt: new Date(),
});

vi.mock('../src/db.js', () => ({
  prisma: mockDb,
  db: {},
  firestoreDb: {},
}));

export { mockDb };
