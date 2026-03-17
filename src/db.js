/**
 * Couche Firestore - remplace Prisma pour la connexion à Firebase Firestore.
 * Utilise firebase-admin.
 *
 * Configuration : GOOGLE_APPLICATION_CREDENTIALS (chemin vers le JSON du service account)
 * ou FIREBASE_SERVICE_ACCOUNT (JSON string pour déploiement)
 */
import admin from 'firebase-admin';

let initialized = false;

function initFirebase() {
  if (initialized) return;
  if (admin.apps.length > 0) {
    initialized = true;
    return;
  }
  try {
    const cred = process.env.FIREBASE_SERVICE_ACCOUNT
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : undefined;
    if (cred) {
      admin.initializeApp({ credential: admin.credential.cert(cred) });
    } else {
      admin.initializeApp(); // utilise GOOGLE_APPLICATION_CREDENTIALS
    }
  } catch (err) {
    console.error(
      'Erreur Firebase: configurez GOOGLE_APPLICATION_CREDENTIALS ou FIREBASE_SERVICE_ACCOUNT. Voir .env.example'
    );
    throw err;
  }
  initialized = true;
}

initFirebase();

export const db = admin.firestore();

/** Convertit un doc Firestore en objet avec id et dates ISO */
function docToObject(doc) {
  if (!doc?.exists) return null;
  const data = doc.data();
  const out = { id: doc.id, ...data };
  for (const k of Object.keys(out)) {
    if (out[k]?.toDate) out[k] = out[k].toDate();
    if (out[k] instanceof Date) out[k] = out[k];
  }
  return out;
}

function docsToArray(snapshot) {
  return snapshot.docs.map((d) => docToObject(d));
}

/** Collections */
const col = (name) => db.collection(name);

export const firestoreDb = {
  hospital: {
    async findMany(opts = {}) {
      let q = col('hospitals');
      if (opts.select) {
        // Firestore n'a pas de select, on récupère tout
      }
      const snap = await q.get();
      let arr = docsToArray(snap);
      if (opts.select?.createdAt !== false) {
        arr = arr.map((x) => ({ id: x.id, name: x.name, address: x.address, createdAt: x.createdAt }));
      }
      return arr;
    },
    async findUnique({ where, include }) {
      const doc = await col('hospitals').doc(where.id).get();
      const obj = docToObject(doc);
      if (!obj) return null;
      if (include?.vehicles) {
        const vSnap = await col('vehicles').where('hospitalId', '==', obj.id).get();
        obj.vehicles = docsToArray(vSnap);
        for (const v of obj.vehicles) {
          const vt = await col('vehicleTypes').doc(v.vehicleTypeId).get();
          v.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
        }
      }
      if (include?.users) {
        const uSnap = await col('users').where('hospitalId', '==', obj.id).get();
        obj.users = uSnap.docs.map((d) => {
          const u = d.data();
          return { id: d.id, email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role };
        });
      }
      return obj;
    },
    async create({ data }) {
      const ref = col('hospitals').doc();
      const payload = {
        ...data,
        createdAt: data.createdAt || new Date(),
        updatedAt: new Date(),
      };
      await ref.set(payload);
      return { id: ref.id, ...payload };
    },
    async update({ where, data }) {
      const ref = col('hospitals').doc(where.id);
      const doc = await ref.get();
      if (!doc.exists) return null;
      const payload = { ...data, updatedAt: new Date() };
      await ref.update(payload);
      const updated = await ref.get();
      return docToObject(updated);
    },
  },

  vehicleType: {
    async findMany(opts = {}) {
      let q = col('vehicleTypes').orderBy('name', 'asc');
      const snap = await q.get();
      let arr = docsToArray(snap);
      if (opts.include?.vehicles) {
        for (const vt of arr) {
          const vSnap = await col('vehicles').where('vehicleTypeId', '==', vt.id).get();
          vt.vehicles = docsToArray(vSnap);
        }
      }
      return arr;
    },
    async findUnique({ where, include }) {
      const doc = await col('vehicleTypes').doc(where.id).get();
      const obj = docToObject(doc);
      if (!obj) return null;
      if (include?.vehicles) {
        const vSnap = await col('vehicles').where('vehicleTypeId', '==', obj.id).get();
        obj.vehicles = docsToArray(vSnap);
      }
      return obj;
    },
    async create({ data }) {
      const ref = col('vehicleTypes').doc();
      const payload = {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await ref.set(payload);
      return { id: ref.id, ...payload };
    },
    async update({ where, data }) {
      const ref = col('vehicleTypes').doc(where.id);
      const doc = await ref.get();
      if (!doc.exists) return null;
      const payload = { ...data, updatedAt: new Date() };
      await ref.update(payload);
      const updated = await ref.get();
      return docToObject(updated);
    },
  },

  user: {
    async findMany({ where = {}, select }) {
      let q = col('users');
      if (where.hospitalId) q = q.where('hospitalId', '==', where.hospitalId);
      const snap = await q.get();
      let arr = docsToArray(snap);
      if (select?.hospital) {
        for (const u of arr) {
          const h = await col('hospitals').doc(u.hospitalId).get();
          u.hospital = h.exists ? { id: h.id, name: h.data().name } : null;
        }
      }
      return arr;
    },
    async findFirst({ where }) {
      let q = col('users');
      if (where.email) q = q.where('email', '==', where.email);
      const snap = await q.limit(1).get();
      if (snap.empty) return null;
      return docToObject(snap.docs[0]);
    },
    async findUnique({ where, include }) {
      const doc = await col('users').doc(where.id).get();
      const obj = docToObject(doc);
      if (!obj) return null;
      if (include?.hospital) {
        const h = await col('hospitals').doc(obj.hospitalId).get();
        obj.hospital = h.exists ? { id: h.id, name: h.data().name } : null;
      }
      return obj;
    },
    async create({ data, select }) {
      const ref = col('users').doc();
      const payload = {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await ref.set(payload);
      const out = { id: ref.id, ...payload };
      delete out.passwordHash;
      return out;
    },
  },

  vehicle: {
    async findMany({ where = {}, include }) {
      let q = col('vehicles');
      if (where.hospitalId) q = q.where('hospitalId', '==', where.hospitalId);
      if (where.vehicleTypeId) q = q.where('vehicleTypeId', '==', where.vehicleTypeId);
      const snap = await q.get();
      let arr = docsToArray(snap);
      if (where.bookings) {
        const inProgress = await col('bookings')
          .where('status', '==', 'in_progress')
          .where('endDate', '==', null)
          .get();
        const busyIds = new Set(inProgress.docs.map((d) => d.data().vehicleId));
        arr = arr.filter((v) => !busyIds.has(v.id));
      }
      if (include?.vehicleType || include?.hospital || include?.photos || include?.model3D) {
        for (const v of arr) {
          if (include.vehicleType) {
            const vt = await col('vehicleTypes').doc(v.vehicleTypeId).get();
            v.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
          }
          if (include.hospital) {
            const h = await col('hospitals').doc(v.hospitalId).get();
            v.hospital = h.exists ? { id: h.id, name: h.data().name } : null;
          }
          if (include.photos) {
            const pSnap = await col('vehiclePhotos').where('vehicleId', '==', v.id).orderBy('takenAt', 'desc').limit(include.photos.take || 5).get();
            v.photos = docsToArray(pSnap);
          }
          if (include.model3D) {
            const m3 = await col('vehicle3D').doc(v.id).get();
            v.model3D = !m3.exists ? null : { id: m3.id, vehicleId: m3.id, ...m3.data() };
          }
        }
      }
      return arr;
    },
    async findUnique({ where, include }) {
      const doc = await col('vehicles').doc(where.id).get();
      const obj = docToObject(doc);
      if (!obj) return null;
      if (include) {
        if (include.vehicleType) {
          const vt = await col('vehicleTypes').doc(obj.vehicleTypeId).get();
          obj.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
        }
        if (include.hospital) {
          const h = await col('hospitals').doc(obj.hospitalId).get();
          obj.hospital = h.exists ? { id: h.id, ...h.data() } : null;
        }
        if (include.photos) {
          const pSnap = await col('vehiclePhotos').where('vehicleId', '==', obj.id).orderBy('takenAt', 'desc').get();
          obj.photos = docsToArray(pSnap);
        }
        if (include.model3D) {
          const m3 = await col('vehicle3D').doc(obj.id).get();
          obj.model3D = !m3.exists ? null : { id: m3.id, vehicleId: m3.id, ...m3.data() };
        }
        if (include.maintenances) {
          const mSnap = await col('maintenances').where('vehicleId', '==', obj.id).orderBy('scheduledAt', 'desc').limit(20).get();
          obj.maintenances = docsToArray(mSnap);
          for (const m of obj.maintenances) {
            if (m.garageId) {
              const g = await col('partnerGarages').doc(m.garageId).get();
              m.garage = g.exists ? { id: g.id, ...g.data() } : null;
            }
          }
        }
        if (include.maintenanceContracts) {
          const cSnap = await col('maintenanceContracts').where('vehicleId', '==', obj.id).get();
          obj.maintenanceContracts = docsToArray(cSnap);
        }
      }
      return obj;
    },
    async create({ data, include }) {
      const ref = col('vehicles').doc();
      const payload = { ...data, createdAt: new Date(), updatedAt: new Date() };
      await ref.set(payload);
      const obj = { id: ref.id, ...payload };
      if (include?.vehicleType) {
        const vt = await col('vehicleTypes').doc(obj.vehicleTypeId).get();
        obj.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
      }
      if (include?.hospital) {
        const h = await col('hospitals').doc(obj.hospitalId).get();
        obj.hospital = h.exists ? { id: h.id, ...h.data() } : null;
      }
      return obj;
    },
    async update({ where, data, include }) {
      const ref = col('vehicles').doc(where.id);
      const doc = await ref.get();
      if (!doc.exists) return null;
      const payload = { ...data, updatedAt: new Date() };
      await ref.update(payload);
      const updated = await ref.get();
      const obj = docToObject(updated);
      if (include?.vehicleType) {
        const vt = await col('vehicleTypes').doc(obj.vehicleTypeId).get();
        obj.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
      }
      if (include?.hospital) {
        const h = await col('hospitals').doc(obj.hospitalId).get();
        obj.hospital = h.exists ? { id: h.id, ...h.data() } : null;
      }
      return obj;
    },
    async delete({ where }) {
      await col('vehicles').doc(where.id).delete();
    },
  },

  authorization: {
    async findMany({ where = {}, include }) {
      let arr = [];
      if (where.user?.hospitalId) {
        const usersSnap = await col('users').where('hospitalId', '==', where.user.hospitalId).get();
        const userIds = usersSnap.docs.map((d) => d.id);
        if (userIds.length === 0) return [];
        for (let i = 0; i < userIds.length; i += 10) {
          const chunk = userIds.slice(i, i + 10);
          let q = col('authorizations').where('userId', 'in', chunk);
          if (where.revokedAt === null) q = q.where('revokedAt', '==', null);
          const snap = await q.get();
          arr.push(...docsToArray(snap));
        }
      } else {
        let q = col('authorizations');
        if (where.userId) q = q.where('userId', '==', where.userId);
        if (where.revokedAt === null) q = q.where('revokedAt', '==', null);
        const snap = await q.get();
        arr = docsToArray(snap);
      }
      if (include?.user || include?.vehicleType) {
        for (const a of arr) {
          if (include.user) {
            const u = await col('users').doc(a.userId).get();
            a.user = u.exists ? { id: u.id, ...u.data(), passwordHash: undefined } : null;
          }
          if (include.vehicleType) {
            const vt = await col('vehicleTypes').doc(a.vehicleTypeId).get();
            a.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
          }
        }
      }
      return arr;
    },
    async findFirst({ where }) {
      const snap = await col('authorizations')
        .where('userId', '==', where.userId)
        .where('vehicleTypeId', '==', where.vehicleTypeId)
        .where('revokedAt', '==', null)
        .limit(1)
        .get();
      return snap.empty ? null : docToObject(snap.docs[0]);
    },
    async findUnique({ where, include }) {
      let obj = null;
      if (where.userId_vehicleTypeId) {
        const { userId, vehicleTypeId } = where.userId_vehicleTypeId;
        const snap = await col('authorizations')
          .where('userId', '==', userId)
          .where('vehicleTypeId', '==', vehicleTypeId)
          .limit(1)
          .get();
        obj = snap.empty ? null : docToObject(snap.docs[0]);
      } else {
        const doc = await col('authorizations').doc(where.id).get();
        obj = docToObject(doc);
      }
      if (!obj) return null;
      if (include?.user) {
        const u = await col('users').doc(obj.userId).get();
        obj.user = u.exists ? { id: u.id, ...u.data() } : null;
      }
      return obj;
    },
    async create({ data, include }) {
      const ref = col('authorizations').doc();
      const payload = {
        ...data,
        grantedAt: data.grantedAt || new Date(),
      };
      await ref.set(payload);
      const obj = { id: ref.id, ...payload };
      if (include?.user) {
        const u = await col('users').doc(obj.userId).get();
        obj.user = u.exists ? { id: u.id, email: u.data().email, firstName: u.data().firstName, lastName: u.data().lastName } : null;
      }
      if (include?.vehicleType) {
        const vt = await col('vehicleTypes').doc(obj.vehicleTypeId).get();
        obj.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
      }
      return obj;
    },
    async update({ where, data, include }) {
      const ref = col('authorizations').doc(where.id);
      const doc = await ref.get();
      if (!doc.exists) return null;
      await ref.update(data);
      const updated = await ref.get();
      const obj = docToObject(updated);
      if (include?.user) {
        const u = await col('users').doc(obj.userId).get();
        obj.user = u.exists ? { id: u.id, email: u.data().email, firstName: u.data().firstName, lastName: u.data().lastName } : null;
      }
      if (include?.vehicleType) {
        const vt = await col('vehicleTypes').doc(obj.vehicleTypeId).get();
        obj.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
      }
      return obj;
    },
  },

  booking: {
    async findMany({ where = {}, include, orderBy, take }) {
      let q = col('bookings');
      if (where.vehicleId) q = q.where('vehicleId', '==', where.vehicleId);
      if (where.userId) q = q.where('userId', '==', where.userId);
      if (where.status) q = q.where('status', '==', where.status);
      q = q.orderBy(orderBy?.startDate || 'startDate', 'desc');
      if (take) q = q.limit(take);
      const snap = await q.get();
      let arr = docsToArray(snap);
      if (include?.vehicle || include?.user) {
        for (const b of arr) {
          if (include.vehicle) {
            const v = await col('vehicles').doc(b.vehicleId).get();
            if (v.exists) {
              const vd = v.data();
              b.vehicle = { id: v.id, ...vd };
              const vt = await col('vehicleTypes').doc(vd.vehicleTypeId).get();
              b.vehicle.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
              const h = await col('hospitals').doc(vd.hospitalId).get();
              b.vehicle.hospital = h.exists ? { id: h.id, name: h.data().name } : null;
              if (include.vehicle.photos) {
                const pSnap = await col('vehiclePhotos').where('vehicleId', '==', b.vehicleId).get();
                b.vehicle.photos = docsToArray(pSnap);
              }
            }
          }
          if (include.user) {
            const u = await col('users').doc(b.userId).get();
            b.user = u.exists ? { id: u.id, firstName: u.data().firstName, lastName: u.data().lastName, email: u.data().email } : null;
          }
        }
      }
      return arr;
    },
    async findUnique({ where, include }) {
      const doc = await col('bookings').doc(where.id).get();
      const obj = docToObject(doc);
      if (!obj) return null;
      if (include?.vehicle) {
        const v = await col('vehicles').doc(obj.vehicleId).get();
        if (v.exists) {
          const vd = v.data();
          obj.vehicle = { id: v.id, ...vd };
          const vt = await col('vehicleTypes').doc(vd.vehicleTypeId).get();
          obj.vehicle.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
          const h = await col('hospitals').doc(vd.hospitalId).get();
          obj.vehicle.hospital = h.exists ? { id: h.id, name: h.data().name } : null;
          const pSnap = await col('vehiclePhotos').where('vehicleId', '==', obj.vehicleId).get();
          obj.vehicle.photos = docsToArray(pSnap);
        }
      }
      if (include?.user) {
        const u = await col('users').doc(obj.userId).get();
        obj.user = u.exists ? { id: u.id, firstName: u.data().firstName, lastName: u.data().lastName, email: u.data().email } : null;
      }
      return obj;
    },
    async create({ data, include }) {
      const ref = col('bookings').doc();
      const payload = { ...data, status: data.status || 'planned', createdAt: new Date(), updatedAt: new Date() };
      await ref.set(payload);
      const obj = { id: ref.id, ...payload };
      if (include?.vehicle) {
        const v = await col('vehicles').doc(obj.vehicleId).get();
        obj.vehicle = v.exists ? { id: v.id, ...v.data() } : null;
        if (obj.vehicle) {
          const vt = await col('vehicleTypes').doc(obj.vehicle.vehicleTypeId).get();
          obj.vehicle.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
        }
      }
      if (include?.user) {
        const u = await col('users').doc(obj.userId).get();
        obj.user = u.exists ? { id: u.id, firstName: u.data().firstName, lastName: u.data().lastName } : null;
      }
      return obj;
    },
    async update({ where, data, include }) {
      const ref = col('bookings').doc(where.id);
      const doc = await ref.get();
      if (!doc.exists) return null;
      const payload = { ...data, updatedAt: new Date() };
      await ref.update(payload);
      const updated = await ref.get();
      const obj = docToObject(updated);
      if (include?.vehicle) {
        const v = await col('vehicles').doc(obj.vehicleId).get();
        obj.vehicle = v.exists ? { id: v.id, ...v.data() } : null;
        if (obj.vehicle) {
          const vt = await col('vehicleTypes').doc(obj.vehicle.vehicleTypeId).get();
          obj.vehicle.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
        }
      }
      if (include?.user) {
        const u = await col('users').doc(obj.userId).get();
        obj.user = u.exists ? { id: u.id, firstName: u.data().firstName, lastName: u.data().lastName } : null;
      }
      return obj;
    },
  },

  vehiclePhoto: {
    async findMany({ where, orderBy }) {
      let q = col('vehiclePhotos').where('vehicleId', '==', where.vehicleId);
      q = q.orderBy(orderBy?.takenAt || 'takenAt', 'desc');
      const snap = await q.get();
      return docsToArray(snap);
    },
    async findUnique({ where, include }) {
      const doc = await col('vehiclePhotos').doc(where.id).get();
      const obj = docToObject(doc);
      if (!obj) return null;
      if (include?.vehicle) {
        const v = await col('vehicles').doc(obj.vehicleId).get();
        obj.vehicle = v.exists ? { id: v.id, ...v.data() } : null;
      }
      return obj;
    },
    async create({ data }) {
      const ref = col('vehiclePhotos').doc();
      const payload = { ...data, takenAt: data.takenAt || new Date() };
      await ref.set(payload);
      return { id: ref.id, ...payload };
    },
    async delete({ where }) {
      await col('vehiclePhotos').doc(where.id).delete();
    },
  },

  problemReport: {
    async findMany({ where, include, orderBy }) {
      if (where.vehicleId === '') return [];
      let q = col('problemReports');
      if (where.vehicleId) {
        if (Array.isArray(where.vehicleId) && where.vehicleId.in) {
          // Firestore 'in' limit 10 - on fait plusieurs requêtes si besoin
          const ids = where.vehicleId.in;
          const all = [];
          for (let i = 0; i < ids.length; i += 10) {
            const chunk = ids.slice(i, i + 10);
            const snap = await col('problemReports').where('vehicleId', 'in', chunk).orderBy('createdAt', 'desc').get();
            all.push(...docsToArray(snap));
          }
          let arr = all;
          if (include?.vehicle || include?.user) {
            for (const r of arr) {
              if (include.vehicle) {
                const v = await col('vehicles').doc(r.vehicleId).get();
                if (v.exists) {
                  const vd = v.data();
                  r.vehicle = { id: v.id, registration: vd.registration, brand: vd.brand, model: vd.model };
                  const vt = await col('vehicleTypes').doc(vd.vehicleTypeId).get();
                  r.vehicle.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
                }
              }
              if (include.user) {
                const u = await col('users').doc(r.userId).get();
                r.user = u.exists ? { id: u.id, firstName: u.data().firstName, lastName: u.data().lastName } : null;
              }
            }
          }
          return arr;
        }
        q = q.where('vehicleId', '==', where.vehicleId);
      }
      if (where.status) q = q.where('status', '==', where.status);
      q = q.orderBy('createdAt', 'desc');
      const snap = await q.get();
      let arr = docsToArray(snap);
      if (include?.vehicle || include?.user) {
        for (const r of arr) {
          if (include?.vehicle) {
            const v = await col('vehicles').doc(r.vehicleId).get();
            if (v.exists) {
              const vd = v.data();
              r.vehicle = { id: v.id, registration: vd.registration, brand: vd.brand, model: vd.model };
              const vt = await col('vehicleTypes').doc(vd.vehicleTypeId).get();
              r.vehicle.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
            }
          }
          if (include?.user) {
            const u = await col('users').doc(r.userId).get();
            r.user = u.exists ? { id: u.id, firstName: u.data().firstName, lastName: u.data().lastName } : null;
          }
        }
      }
      return arr;
    },
    async findUnique({ where, include }) {
      const doc = await col('problemReports').doc(where.id).get();
      const obj = docToObject(doc);
      if (!obj) return null;
      if (include?.vehicle) {
        const v = await col('vehicles').doc(obj.vehicleId).get();
        obj.vehicle = v.exists ? { id: v.id, ...v.data() } : null;
        if (obj.vehicle) {
          const vt = await col('vehicleTypes').doc(obj.vehicle.vehicleTypeId).get();
          obj.vehicle.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
          const h = await col('hospitals').doc(obj.vehicle.hospitalId).get();
          obj.vehicle.hospital = h.exists ? { id: h.id, ...h.data() } : null;
        }
      }
      if (include?.user) {
        const u = await col('users').doc(obj.userId).get();
        obj.user = u.exists ? { id: u.id, firstName: u.data().firstName, lastName: u.data().lastName, email: u.data().email } : null;
      }
      return obj;
    },
    async create({ data, include }) {
      const ref = col('problemReports').doc();
      const payload = { ...data, status: data.status || 'ouvert', createdAt: new Date(), updatedAt: new Date() };
      await ref.set(payload);
      const obj = { id: ref.id, ...payload };
      if (include?.vehicle) {
        const v = await col('vehicles').doc(obj.vehicleId).get();
        obj.vehicle = v.exists ? { id: v.id, ...v.data() } : null;
        if (obj.vehicle) {
          const vt = await col('vehicleTypes').doc(obj.vehicle.vehicleTypeId).get();
          obj.vehicle.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
        }
      }
      if (include?.user) {
        const u = await col('users').doc(obj.userId).get();
        obj.user = u.exists ? { id: u.id, firstName: u.data().firstName, lastName: u.data().lastName } : null;
      }
      return obj;
    },
    async update({ where, data, include }) {
      const ref = col('problemReports').doc(where.id);
      const doc = await ref.get();
      if (!doc.exists) return null;
      const payload = { ...data, updatedAt: new Date() };
      await ref.update(payload);
      const updated = await ref.get();
      const obj = docToObject(updated);
      if (include?.vehicle) {
        const v = await col('vehicles').doc(obj.vehicleId).get();
        obj.vehicle = v.exists ? { id: v.id, ...v.data() } : null;
        if (obj.vehicle) {
          const vt = await col('vehicleTypes').doc(obj.vehicle.vehicleTypeId).get();
          obj.vehicle.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
        }
      }
      if (include?.user) {
        const u = await col('users').doc(obj.userId).get();
        obj.user = u.exists ? { id: u.id, firstName: u.data().firstName, lastName: u.data().lastName } : null;
      }
      return obj;
    },
  },

  odometerReading: {
    async findMany({ where, include, orderBy, take }) {
      let q = col('odometerReadings').where('vehicleId', '==', where.vehicleId).orderBy('readAt', 'desc');
      if (take) q = q.limit(take);
      const snap = await q.get();
      let arr = docsToArray(snap);
      if (include?.user) {
        for (const r of arr) {
          const u = await col('users').doc(r.userId).get();
          r.user = u.exists ? { id: u.id, firstName: u.data().firstName, lastName: u.data().lastName } : null;
        }
      }
      return arr;
    },
    async create({ data, include }) {
      const ref = col('odometerReadings').doc();
      const payload = { ...data, readAt: new Date() };
      await ref.set(payload);
      const obj = { id: ref.id, ...payload };
      if (include?.user) {
        const u = await col('users').doc(obj.userId).get();
        obj.user = u.exists ? { id: u.id, firstName: u.data().firstName, lastName: u.data().lastName } : null;
      }
      return obj;
    },
  },

  partnerGarage: {
    async findMany({ where = {} }) {
      let q = col('partnerGarages');
      if (where.hospitalId) q = q.where('hospitalId', '==', where.hospitalId);
      const snap = await q.get();
      return docsToArray(snap);
    },
    async create({ data }) {
      const ref = col('partnerGarages').doc();
      const payload = { ...data, createdAt: new Date(), updatedAt: new Date() };
      await ref.set(payload);
      return { id: ref.id, ...payload };
    },
  },

  maintenanceContract: {
    async findMany({ where }) {
      const snap = await col('maintenanceContracts').where('vehicleId', '==', where.vehicleId).get();
      return docsToArray(snap);
    },
    async create({ data }) {
      const ref = col('maintenanceContracts').doc();
      const payload = { ...data, createdAt: new Date(), updatedAt: new Date() };
      await ref.set(payload);
      return { id: ref.id, ...payload };
    },
  },

  maintenance: {
    async findMany({ where, include, orderBy }) {
      let q = col('maintenances');
      if (where.vehicleId) {
        if (where.vehicleId.in) {
          const ids = where.vehicleId.in;
          const all = [];
          for (let i = 0; i < ids.length; i += 10) {
            const chunk = ids.slice(i, i + 10);
            const snap = await col('maintenances').where('vehicleId', 'in', chunk).orderBy('scheduledAt', 'desc').get();
            all.push(...docsToArray(snap));
          }
          let arr = all;
          for (const m of arr) {
            if (include?.vehicle) {
              const v = await col('vehicles').doc(m.vehicleId).get();
              m.vehicle = v.exists ? { id: v.id, ...v.data() } : null;
              if (m.vehicle) {
                const vt = await col('vehicleTypes').doc(m.vehicle.vehicleTypeId).get();
                m.vehicle.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
              }
            }
            if (include?.garage && m.garageId) {
              const g = await col('partnerGarages').doc(m.garageId).get();
              m.garage = g.exists ? { id: g.id, ...g.data() } : null;
            }
            if (include?.contract && m.contractId) {
              const c = await col('maintenanceContracts').doc(m.contractId).get();
              m.contract = c.exists ? { id: c.id, ...c.data() } : null;
            }
          }
          return arr;
        }
        q = q.where('vehicleId', '==', where.vehicleId);
      }
      if (where.type) q = q.where('type', '==', where.type);
      if (where.status) q = q.where('status', '==', where.status);
      q = q.orderBy('scheduledAt', 'desc');
      const snap = await q.get();
      let arr = docsToArray(snap);
      for (const m of arr) {
        if (include?.vehicle) {
          const v = await col('vehicles').doc(m.vehicleId).get();
          m.vehicle = v.exists ? { id: v.id, ...v.data() } : null;
          if (m.vehicle) {
            const vt = await col('vehicleTypes').doc(m.vehicle.vehicleTypeId).get();
            m.vehicle.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
          }
        }
        if (include?.garage && m.garageId) {
          const g = await col('partnerGarages').doc(m.garageId).get();
          m.garage = g.exists ? { id: g.id, ...g.data() } : null;
        }
        if (include?.contract && m.contractId) {
          const c = await col('maintenanceContracts').doc(m.contractId).get();
          m.contract = c.exists ? { id: c.id, ...c.data() } : null;
        }
      }
      return arr;
    },
    async findUnique({ where, include }) {
      const doc = await col('maintenances').doc(where.id).get();
      const obj = docToObject(doc);
      if (!obj) return null;
      if (include?.vehicle) {
        const v = await col('vehicles').doc(obj.vehicleId).get();
        obj.vehicle = v.exists ? { id: v.id, ...v.data() } : null;
        if (obj.vehicle) {
          const vt = await col('vehicleTypes').doc(obj.vehicle.vehicleTypeId).get();
          obj.vehicle.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
          const h = await col('hospitals').doc(obj.vehicle.hospitalId).get();
          obj.vehicle.hospital = h.exists ? { id: h.id, ...h.data() } : null;
        }
      }
      if (include?.garage && obj.garageId) {
        const g = await col('partnerGarages').doc(obj.garageId).get();
        obj.garage = g.exists ? { id: g.id, ...g.data() } : null;
      }
      if (include?.contract && obj.contractId) {
        const c = await col('maintenanceContracts').doc(obj.contractId).get();
        obj.contract = c.exists ? { id: c.id, ...c.data() } : null;
      }
      return obj;
    },
    async create({ data, include }) {
      const ref = col('maintenances').doc();
      const payload = { ...data, status: data.status || 'planifie', createdAt: new Date(), updatedAt: new Date() };
      await ref.set(payload);
      const obj = { id: ref.id, ...payload };
      if (include?.vehicle) {
        const v = await col('vehicles').doc(obj.vehicleId).get();
        obj.vehicle = v.exists ? { id: v.id, ...v.data() } : null;
        if (obj.vehicle) {
          const vt = await col('vehicleTypes').doc(obj.vehicle.vehicleTypeId).get();
          obj.vehicle.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
        }
      }
      if (include?.garage && obj.garageId) {
        const g = await col('partnerGarages').doc(obj.garageId).get();
        obj.garage = g.exists ? { id: g.id, ...g.data() } : null;
      }
      if (include?.contract && obj.contractId) {
        const c = await col('maintenanceContracts').doc(obj.contractId).get();
        obj.contract = c.exists ? { id: c.id, ...c.data() } : null;
      }
      return obj;
    },
    async update({ where, data, include }) {
      const ref = col('maintenances').doc(where.id);
      const doc = await ref.get();
      if (!doc.exists) return null;
      const payload = { ...data, updatedAt: new Date() };
      await ref.update(payload);
      const updated = await ref.get();
      const obj = docToObject(updated);
      if (include?.vehicle) {
        const v = await col('vehicles').doc(obj.vehicleId).get();
        obj.vehicle = v.exists ? { id: v.id, ...v.data() } : null;
        if (obj.vehicle) {
          const vt = await col('vehicleTypes').doc(obj.vehicle.vehicleTypeId).get();
          obj.vehicle.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
        }
      }
      if (include?.garage && obj.garageId) {
        const g = await col('partnerGarages').doc(obj.garageId).get();
        obj.garage = g.exists ? { id: g.id, ...g.data() } : null;
      }
      if (include?.contract && obj.contractId) {
        const c = await col('maintenanceContracts').doc(obj.contractId).get();
        obj.contract = c.exists ? { id: c.id, ...c.data() } : null;
      }
      return obj;
    },
  },

  assistanceRequest: {
    async findMany({ where, include }) {
      let q = col('assistanceRequests');
      if (where.vehicleId) {
        if (where.vehicleId.in) {
          const ids = where.vehicleId.in;
          const all = [];
          for (let i = 0; i < ids.length; i += 10) {
            const chunk = ids.slice(i, i + 10);
            const snap = await col('assistanceRequests').where('vehicleId', 'in', chunk).orderBy('createdAt', 'desc').get();
            all.push(...docsToArray(snap));
          }
          for (const r of all) {
            if (include?.vehicle) {
              const v = await col('vehicles').doc(r.vehicleId).get();
              r.vehicle = v.exists ? { id: v.id, ...v.data() } : null;
              if (r.vehicle) {
                const vt = await col('vehicleTypes').doc(r.vehicle.vehicleTypeId).get();
                r.vehicle.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
              }
            }
          }
          return all;
        }
        q = q.where('vehicleId', '==', where.vehicleId);
      }
      if (where.status) q = q.where('status', '==', where.status);
      q = q.orderBy('createdAt', 'desc');
      const snap = await q.get();
      let arr = docsToArray(snap);
      for (const r of arr) {
        if (include?.vehicle) {
          const v = await col('vehicles').doc(r.vehicleId).get();
          r.vehicle = v.exists ? { id: v.id, ...v.data() } : null;
          if (r.vehicle) {
            const vt = await col('vehicleTypes').doc(r.vehicle.vehicleTypeId).get();
            r.vehicle.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
          }
        }
      }
      return arr;
    },
    async findUnique({ where, include }) {
      const doc = await col('assistanceRequests').doc(where.id).get();
      const obj = docToObject(doc);
      if (!obj) return null;
      if (include?.vehicle) {
        const v = await col('vehicles').doc(obj.vehicleId).get();
        obj.vehicle = v.exists ? { id: v.id, ...v.data() } : null;
        if (obj.vehicle) {
          const vt = await col('vehicleTypes').doc(obj.vehicle.vehicleTypeId).get();
          obj.vehicle.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
        }
      }
      return obj;
    },
    async create({ data, include }) {
      const ref = col('assistanceRequests').doc();
      const payload = { ...data, status: data.status || 'ouverte', createdAt: new Date(), updatedAt: new Date() };
      await ref.set(payload);
      const obj = { id: ref.id, ...payload };
      if (include?.vehicle) {
        const v = await col('vehicles').doc(obj.vehicleId).get();
        obj.vehicle = v.exists ? { id: v.id, ...v.data() } : null;
        if (obj.vehicle) {
          const vt = await col('vehicleTypes').doc(obj.vehicle.vehicleTypeId).get();
          obj.vehicle.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
        }
      }
      return obj;
    },
    async update({ where, data, include }) {
      const ref = col('assistanceRequests').doc(where.id);
      const doc = await ref.get();
      if (!doc.exists) return null;
      const payload = { ...data, updatedAt: new Date() };
      await ref.update(payload);
      const updated = await ref.get();
      const obj = docToObject(updated);
      if (include?.vehicle) {
        const v = await col('vehicles').doc(obj.vehicleId).get();
        obj.vehicle = v.exists ? { id: v.id, ...v.data() } : null;
        if (obj.vehicle) {
          const vt = await col('vehicleTypes').doc(obj.vehicle.vehicleTypeId).get();
          obj.vehicle.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
        }
      }
      return obj;
    },
  },

  interventionRequest: {
    async findMany({ where = {}, include, orderBy }) {
      let q = col('interventionRequests');
      if (where.createdById) q = q.where('createdById', '==', where.createdById);
      if (where.vehicleId) q = q.where('vehicleId', '==', where.vehicleId);
      if (where.status) q = q.where('status', '==', where.status);
      q = q.orderBy('createdAt', 'desc');
      const snap = await q.get();
      let arr = docsToArray(snap);
      for (const r of arr) {
        if (include?.vehicle) {
          const v = await col('vehicles').doc(r.vehicleId).get();
          r.vehicle = v.exists ? { id: v.id, ...v.data() } : null;
          if (r.vehicle) {
            const vt = await col('vehicleTypes').doc(r.vehicle.vehicleTypeId).get();
            r.vehicle.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
          }
        }
        if (include?.createdBy) {
          const u = await col('users').doc(r.createdById).get();
          r.createdBy = u.exists ? { id: u.id, firstName: u.data().firstName, lastName: u.data().lastName, email: u.data().email } : null;
        }
        if (include?.assignedTo && r.assignedToId) {
          const u = await col('users').doc(r.assignedToId).get();
          r.assignedTo = u.exists ? { id: u.id, firstName: u.data().firstName, lastName: u.data().lastName } : null;
        }
        if (include?.statusHistory) {
          const hSnap = await col('interventionStatusHistory').where('requestId', '==', r.id).orderBy('createdAt', 'asc').get();
          r.statusHistory = docsToArray(hSnap);
        }
      }
      return arr;
    },
    async findUnique({ where, include }) {
      const doc = await col('interventionRequests').doc(where.id).get();
      const obj = docToObject(doc);
      if (!obj) return null;
      if (include?.vehicle) {
        const v = await col('vehicles').doc(obj.vehicleId).get();
        obj.vehicle = v.exists ? { id: v.id, ...v.data() } : null;
        if (obj.vehicle) {
          const vt = await col('vehicleTypes').doc(obj.vehicle.vehicleTypeId).get();
          obj.vehicle.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
          const h = await col('hospitals').doc(obj.vehicle.hospitalId).get();
          obj.vehicle.hospital = h.exists ? { id: h.id, ...h.data() } : null;
        }
      }
      if (include?.createdBy) {
        const u = await col('users').doc(obj.createdById).get();
        obj.createdBy = u.exists ? { id: u.id, firstName: u.data().firstName, lastName: u.data().lastName, email: u.data().email } : null;
      }
      if (include?.assignedTo && obj.assignedToId) {
        const u = await col('users').doc(obj.assignedToId).get();
        obj.assignedTo = u.exists ? { id: u.id, firstName: u.data().firstName, lastName: u.data().lastName } : null;
      }
      if (include?.statusHistory) {
        const hSnap = await col('interventionStatusHistory').where('requestId', '==', obj.id).orderBy(include.statusHistory?.orderBy?.createdAt || 'createdAt', 'asc').get();
        obj.statusHistory = docsToArray(hSnap);
      }
      return obj;
    },
    async create({ data, include }) {
      const ref = col('interventionRequests').doc();
      const payload = { ...data, status: data.status || 'nouvelle', createdAt: new Date(), updatedAt: new Date() };
      await ref.set(payload);
      const obj = { id: ref.id, ...payload };
      if (include?.vehicle) {
        const v = await col('vehicles').doc(obj.vehicleId).get();
        obj.vehicle = v.exists ? { id: v.id, ...v.data() } : null;
        if (obj.vehicle) {
          const vt = await col('vehicleTypes').doc(obj.vehicle.vehicleTypeId).get();
          obj.vehicle.vehicleType = vt.exists ? { id: vt.id, ...vt.data() } : null;
        }
      }
      if (include?.createdBy) {
        const u = await col('users').doc(obj.createdById).get();
        obj.createdBy = u.exists ? { id: u.id, firstName: u.data().firstName, lastName: u.data().lastName } : null;
      }
      if (include?.statusHistory) {
        obj.statusHistory = [];
      }
      return obj;
    },
    async update({ where, data, include }) {
      const ref = col('interventionRequests').doc(where.id);
      const doc = await ref.get();
      if (!doc.exists) return null;
      const payload = { ...data, updatedAt: new Date() };
      await ref.update(payload);
      const updated = await ref.get();
      const obj = docToObject(updated);
      if (include?.createdBy) {
        const u = await col('users').doc(obj.createdById).get();
        obj.createdBy = u.exists ? { id: u.id, firstName: u.data().firstName, lastName: u.data().lastName } : null;
      }
      if (include?.assignedTo && obj.assignedToId) {
        const u = await col('users').doc(obj.assignedToId).get();
        obj.assignedTo = u.exists ? { id: u.id, firstName: u.data().firstName, lastName: u.data().lastName } : null;
      }
      if (include?.statusHistory) {
        const hSnap = await col('interventionStatusHistory').where('requestId', '==', obj.id).orderBy('createdAt', 'asc').get();
        obj.statusHistory = docsToArray(hSnap);
      }
      return obj;
    },
  },

  interventionStatusHistory: {
    async create({ data }) {
      const ref = col('interventionStatusHistory').doc();
      const payload = { ...data, createdAt: new Date() };
      await ref.set(payload);
      return { id: ref.id, ...payload };
    },
  },

  vehicle3D: {
    async findUnique({ where }) {
      const doc = await col('vehicle3D').doc(where.vehicleId).get();
      if (!doc.exists) return null;
      return { id: doc.id, vehicleId: doc.id, ...doc.data() };
    },
    async create({ data }) {
      const vehicleId = data.vehicleId;
      const ref = col('vehicle3D').doc(vehicleId);
      const payload = { ...data, createdAt: new Date(), updatedAt: new Date() };
      await ref.set(payload);
      return { id: vehicleId, vehicleId, ...payload };
    },
    async update({ where, data }) {
      const ref = col('vehicle3D').doc(where.vehicleId);
      const doc = await ref.get();
      if (!doc.exists) return null;
      const payload = { ...data, updatedAt: new Date() };
      await ref.update(payload);
      const updated = await ref.get();
      return { id: ref.id, vehicleId: ref.id, ...updated.data() };
    },
    async deleteMany({ where }) {
      await col('vehicle3D').doc(where.vehicleId).delete();
    },
  },
};

/** API compatible Prisma : prisma.hospital.findMany() etc. */
export const prisma = {
  hospital: firestoreDb.hospital,
  vehicleType: firestoreDb.vehicleType,
  user: firestoreDb.user,
  vehicle: firestoreDb.vehicle,
  authorization: firestoreDb.authorization,
  booking: firestoreDb.booking,
  vehiclePhoto: firestoreDb.vehiclePhoto,
  problemReport: firestoreDb.problemReport,
  odometerReading: firestoreDb.odometerReading,
  partnerGarage: firestoreDb.partnerGarage,
  maintenanceContract: firestoreDb.maintenanceContract,
  maintenance: firestoreDb.maintenance,
  assistanceRequest: firestoreDb.assistanceRequest,
  interventionRequest: firestoreDb.interventionRequest,
  interventionStatusHistory: firestoreDb.interventionStatusHistory,
  vehicle3D: firestoreDb.vehicle3D,
};
