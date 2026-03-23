/**
 * Seed Firestore avec des données de démonstration.
 * Crée les utilisateurs dans Firebase Auth + profils dans Firestore.
 * Exécuter : node scripts/seed-firestore.js
 *
 * Nécessite GOOGLE_APPLICATION_CREDENTIALS ou FIREBASE_SERVICE_ACCOUNT.
 */
import 'dotenv/config';
import admin from 'firebase-admin';

const ROLE_USAGER = 0;
const ROLE_GESTIONNAIRE = 1;
const ROLE_ADMIN = 2;
const ROLE_SUPER_ADMIN = 3;

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

  // Utilisateurs Firebase Auth + Firestore (rôle 0=usager, 1=gestionnaire, 2=admin, 3=super_admin)
  const password = 'password123';
  let supervisorUid, staffUid, superAdminUid;

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

    const superAdmin = await admin.auth().createUser({
      email: 'superadmin@chu.fr',
      password,
      displayName: 'Super Admin',
    });
    superAdminUid = superAdmin.uid;
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      console.log('Utilisateurs Firebase déjà existants. Supprimez-les dans la console Firebase si besoin.');
      const existing = await admin.auth().getUsersByEmail(['admin@chu.fr', 'usager@chu.fr', 'superadmin@chu.fr']);
      const byEmail = (e) => existing.users.find((u) => u.email === e)?.uid;
      supervisorUid = byEmail('admin@chu.fr');
      staffUid = byEmail('usager@chu.fr');
      superAdminUid = byEmail('superadmin@chu.fr');
      if (!supervisorUid || !staffUid || !superAdminUid) throw new Error('Impossible de récupérer les utilisateurs existants');
    } else throw err;
  }

  await db.collection('users').doc(supervisorUid).set({
    email: 'admin@chu.fr',
    firstName: 'Marie',
    lastName: 'Admin',
    role: ROLE_ADMIN,
    hospitalId,
    isDeactivated: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.collection('users').doc(staffUid).set({
    email: 'usager@chu.fr',
    firstName: 'Jean',
    lastName: 'Usager',
    role: ROLE_USAGER,
    hospitalId,
    isDeactivated: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.collection('users').doc(superAdminUid).set({
    email: 'superadmin@chu.fr',
    firstName: 'Super',
    lastName: 'Admin',
    role: ROLE_SUPER_ADMIN,
    hospitalId: null,
    isDeactivated: false,
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
    users: 'admin@chu.fr (role 2), usager@chu.fr (role 0), superadmin@chu.fr (role 3)',
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
