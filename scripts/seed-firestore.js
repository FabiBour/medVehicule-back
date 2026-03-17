/**
 * Seed Firestore avec des données de démonstration.
 * Crée les utilisateurs dans Firebase Auth + profils dans Firestore.
 * Exécuter : node scripts/seed-firestore.js
 *
 * Nécessite GOOGLE_APPLICATION_CREDENTIALS ou FIREBASE_SERVICE_ACCOUNT.
 */
import 'dotenv/config';
import admin from 'firebase-admin';

const ROLE_ADMIN = 0;
const ROLE_GESTIONNAIRE = 1;
const ROLE_USAGER = 2;

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

  // Hospital
  const hospitalRef = db.collection('hospitals').doc();
  await hospitalRef.set({
    name: "CHU Centre",
    address: "2 rue de l'Hôpital, 45000 Orléans",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const hospitalId = hospitalRef.id;

  // Types de véhicules
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

  // Utilisateurs Firebase Auth + Firestore (rôle 0=admin, 1=gestionnaire, 2=usager)
  const password = 'password123';
  let supervisorUid, staffUid;

  try {
    const supervisor = await admin.auth().createUser({
      email: 'admin@chu.fr',
      password,
      displayName: 'Marie Admin',
    });
    supervisorUid = supervisor.uid;

    const staff = await admin.auth().createUser({
      email: 'usager@chu.fr',
      password,
      displayName: 'Jean Usager',
    });
    staffUid = staff.uid;
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      console.log('Utilisateurs Firebase déjà existants. Supprimez-les dans la console Firebase si besoin.');
      const existing = await admin.auth().getUsersByEmail(['admin@chu.fr', 'usager@chu.fr']);
      supervisorUid = existing.users[0]?.uid;
      staffUid = existing.users[1]?.uid;
      if (!supervisorUid || !staffUid) throw new Error('Impossible de récupérer les utilisateurs existants');
    } else throw err;
  }

  await db.collection('users').doc(supervisorUid).set({
    email: 'admin@chu.fr',
    firstName: 'Marie',
    lastName: 'Admin',
    role: ROLE_ADMIN,
    hospitalId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.collection('users').doc(staffUid).set({
    email: 'usager@chu.fr',
    firstName: 'Jean',
    lastName: 'Usager',
    role: ROLE_USAGER,
    hospitalId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.collection('authorizations').doc().set({
    userId: staffUid,
    vehicleTypeId: typeIds[0],
    grantedBy: supervisorUid,
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
    users: 'admin@chu.fr (role 0), usager@chu.fr (role 2)',
    vehicle: 'AB-123-CD',
    password: 'password123',
  });
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
