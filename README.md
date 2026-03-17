# MedVehicule API

API REST Node.js pour la gestion de la flotte de véhicules d’un hôpital : location, droits d’utilisation, signalements, entretien, demandes d’intervention et modèles 3D.

## Fonctionnalités

- **Établissements et flotte** : hôpitaux, types de véhicules (voiture, ambulance, hélicoptère…), véhicules.
- **Droits d’utilisation** : les superviseurs accordent aux personnels le droit d’utiliser certains types de véhicules.
- **Location / prise** : réservation, démarrage (relevé compteur départ), restitution (relevé compteur fin).
- **Photos** : état des lieux (avant/après), signalements avec photos.
- **Signalements** : rayures, impacts, pannes ; suivi de statut (ouvert, en cours, clôturé).
- **Relevé compteur** : enregistrement des kilométrages (prise, restitution, entretien).
- **Entretien** : contrôle technique, révision, réparation ; garages partenaires ; contrats d’entretien.
- **Demande d’assistance** : panne, accident, dépannage ; suivi (ouverte, en route, traitée).
- **Demandes d’intervention** : le personnel crée des demandes pour le superviseur ; suivi avec historique de statut.
- **Historique** : prises, interventions, entretiens par véhicule.
- **Modèle 3D** : upload et URL d’un fichier glTF/GLB par véhicule (visualisation iOS, Android, Web).

## Prérequis

- Node.js 18+
- npm ou yarn

## Installation

```bash
npm install
cp .env.example .env
# Éditer .env : JWT_SECRET, GOOGLE_APPLICATION_CREDENTIALS ou FIREBASE_SERVICE_ACCOUNT
npm run db:seed
```

**Configuration Firebase** : Créez un projet sur [Firebase Console](https://console.firebase.google.com/), activez Firestore, puis téléchargez la clé du compte de service. Définissez `GOOGLE_APPLICATION_CREDENTIALS` (chemin vers le JSON) ou `FIREBASE_SERVICE_ACCOUNT` (JSON en variable).

## Démarrage

```bash
npm run dev    # développement (watch)
npm start      # production
```

Par défaut l’API écoute sur `http://localhost:3000`.

**Documentation Swagger** : `http://localhost:3000/api-docs` — interface interactive pour tester les endpoints.

## Authentification

- **POST /api/auth/login**  
  Body : `{ "email", "password" }`  
  Réponse : `{ "token", "user" }`

- **GET /api/auth/me**  
  Header : `Authorization: Bearer <token>`  
  Réponse : utilisateur courant.

Compte de test après seed :  
- Superviseur : `supervisor@chu.fr` / `password123`  
- Staff : `staff@chu.fr` / `password123`

## Principales routes (toutes sous `/api`, auth Bearer sauf login)

| Ressource | Méthodes | Description |
|-----------|----------|-------------|
| **hospitals** | GET, GET /:id, POST, PATCH /:id | Établissements |
| **vehicle-types** | GET, GET /:id, POST, PATCH /:id | Types de véhicules |
| **vehicles** | GET, GET /:id, POST, PATCH /:id, DELETE /:id | Véhicules ; GET ?hospitalId=&vehicleTypeId=&available= |
| **vehicles/:id/history** | GET | Historique (prises, interventions, entretiens) |
| **users** | GET, POST | Utilisateurs (liste, création par superviseur) |
| **authorizations** | GET, GET /user/:userId, POST, POST /:id/revoke | Droits d’utilisation par type de véhicule |
| **bookings** | GET, GET /:id, POST, PATCH /:id/start, PATCH /:id/complete, PATCH /:id/cancel | Réservations / prises |
| **photos** | GET /vehicle/:vehicleId, POST /vehicle/:vehicleId (multipart), DELETE /:photoId | Photos véhicule |
| **problem-reports** | GET, GET /:id, POST, PATCH /:id | Signalements |
| **odometer** | GET /vehicle/:vehicleId, POST /vehicle/:vehicleId | Relevés compteur |
| **maintenance** | GET, GET /:id, POST, PATCH /:id | Entretiens (CT, révision, etc.) |
| **maintenance/garages/list** | GET | Garages partenaires |
| **maintenance/garages** | POST | Créer garage |
| **maintenance/contracts/vehicle/:vehicleId** | GET | Contrats d’un véhicule |
| **maintenance/contracts** | POST | Créer contrat |
| **assistance** | GET, POST, PATCH /:id | Demandes d’assistance |
| **interventions** | GET, GET /:id, POST, PATCH /:id | Demandes d’intervention + suivi |
| **vehicle3d** | GET /vehicle/:vehicleId, POST /vehicle/:vehicleId (multipart), DELETE /vehicle/:vehicleId | Modèle 3D (glb/gltf) |

## Modèle 3D

- Format attendu : **glTF (.gltf)** ou **GLB (.glb)** pour compatibilité iOS, Android et Web.
- **GET /api/vehicle3d/vehicle/:vehicleId** retourne `{ format, url }`. L’URL pointe vers le fichier servi sous `/uploads/models3d/`.
- Les clients peuvent charger ce fichier dans un viewer 3D (ex. Three.js, SceneKit, Model I/O, etc.).

## Fichiers

- Photos : `uploads/photos/`
- Modèles 3D : `uploads/models3d/`
- Base de données : **Firebase Firestore** (NoSQL document database).

## Licence

MIT.
