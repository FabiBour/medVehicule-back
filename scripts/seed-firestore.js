/**
 * Seed Firestore avec des données de démonstration.
 * Exécuter : node scripts/seed-firestore.js
 *
 * Nécessite GOOGLE_APPLICATION_CREDENTIALS ou FIREBASE_SERVICE_ACCOUNT.
 */
import 'dotenv/config';
import admin from 'firebase-admin';
import bcrypt from 'bcryptjs';

function initFirebase() {
  if (admin.apps.length > 0) return admin.firestore();
  const cred = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : undefined;
  if (cred) {
    admin.initializeApp({ credential: admin.credential.cert(cred) });
  } else {
    admin.initializeApp();
  }
  return admin.firestore();
}

const db = initFirebase();

async function deleteCollection(collectionName) {
  const col = db.collection(collectionName);
  const snap = await col.get();
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  if (snap.docs.length > 0) await batch.commit();
}

async function main() {
  // Ordre de suppression (respect des dépendances)
  const collections = [
    'interventionStatusHistory',
    'interventionRequests',
    'assistanceRequests',
    'maintenances',
    'maintenanceContracts',
    'odometerReadings',
    'problemReports',
    'vehiclePhotos',
    'vehicle3D',
    'bookings',
    'authorizations',
    'vehicles',
    'partnerGarages',
    'users',
    'vehicleTypes',
    'hospitals',
  ];

  console.log('Suppression des collections existantes...');
  for (const name of collections) {
    await deleteCollection(name);
  }

  // Création des données
  const hospitalRef = db.collection('hospitals').doc();
  await hospitalRef.set({
    name: "CHU Centre",
    address: "2 rue de l'Hôpital, 45000 Orléans",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const hospitalId = hospitalRef.id;

  const types = [
    { name: 'Voiture', description: 'Véhicule léger' },
    { name: 'Ambulance', description: 'Véhicule sanitaire' },
    { name: 'Hélicoptère', description: 'SMUR / évacuation' },
  ];
  const typeIds = [];
  for (const t of types) {
    const ref = db.collection('vehicleTypes').doc();
    await ref.set({
      ...t,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    typeIds.push(ref.id);
  }

  const passwordHash = await bcrypt.hash('password123', 10);

  const supervisorRef = db.collection('users').doc();
  await supervisorRef.set({
    hospitalId,
    email: 'supervisor@chu.fr',
    passwordHash,
    firstName: 'Marie',
    lastName: 'Supervisor',
    role: 'supervisor',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const staffRef = db.collection('users').doc();
  await staffRef.set({
    hospitalId,
    email: 'staff@chu.fr',
    passwordHash,
    firstName: 'Jean',
    lastName: 'Staff',
    role: 'staff',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.collection('authorizations').doc().set({
    userId: staffRef.id,
    vehicleTypeId: typeIds[0],
    grantedBy: supervisorRef.id,
    grantedAt: new Date(),
  });

  const vehicleRef = db.collection('vehicles').doc();
  await vehicleRef.set({
    hospitalId,
    vehicleTypeId: typeIds[0],
    registration: 'AB-123-CD',
    brand: 'Renault',
    model: 'Espace',
    year: 2022,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log('Seed OK:', {
    hospital: 'CHU Centre',
    users: 2,
    vehicle: 'AB-123-CD',
  });
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
