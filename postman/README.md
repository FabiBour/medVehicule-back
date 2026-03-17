# Collection Postman MedVehicule API

## Import

1. **Postman** → **Import** → **Upload Files**
2. Sélectionner :
   - `MedVehicule-API.postman_collection.json`
   - `MedVehicule-Production.postman_environment.json` (optionnel)
   - `MedVehicule-Local.postman_environment.json` (optionnel)

## Configuration

1. Choisir l’environnement **MedVehicule Production** ou **MedVehicule Local** dans le sélecteur d’environnement.
2. Renseigner la variable **firebaseToken** avec votre Firebase ID token :
   - Obtenu côté client après `signInWithEmailAndPassword` ou `signInWithCustomToken`
   - Via `user.getIdToken()` dans le SDK Firebase
3. Pour les requêtes qui utilisent des IDs (établissement, véhicule, réservation, etc.), remplir les variables correspondantes dans l’environnement.

## Structure

- **Système** : Health
- **Authentification** : login, register, me
- **Établissements** : CRUD
- **Types de véhicules** : CRUD
- **Véhicules** : CRUD, historique
- **Utilisateurs** : liste, création (admin), modification du rôle
- **Autorisations** : liste, accorder, révoquer
- **Réservations** : CRUD, démarrer/terminer prise, annuler
- **Photos** : liste, ajout, suppression
- **Signalements** : CRUD
- **Compteur** : relevés
- **Entretien** : CRUD, garages, contrats
- **Assistance** : liste, création, mise à jour
- **Interventions** : CRUD
- **Modèle 3D** : get, upload, delete

## Swagger

Documentation interactive : https://medvehicule-back.onrender.com/api-docs
