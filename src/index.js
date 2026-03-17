import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { swaggerDocument } from './swagger.js';
import { authRouter } from './routes/auth.js';
import { hospitalsRouter } from './routes/hospitals.js';
import { vehicleTypesRouter } from './routes/vehicle-types.js';
import { vehiclesRouter } from './routes/vehicles.js';
import { usersRouter } from './routes/users.js';
import { authorizationsRouter } from './routes/authorizations.js';
import { bookingsRouter } from './routes/bookings.js';
import { photosRouter } from './routes/photos.js';
import { problemReportsRouter } from './routes/problem-reports.js';
import { odometerRouter } from './routes/odometer.js';
import { maintenanceRouter } from './routes/maintenance.js';
import { assistanceRouter } from './routes/assistance.js';
import { interventionsRouter } from './routes/interventions.js';
import { vehicle3dRouter } from './routes/vehicle3d.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const uploadDir = path.isAbsolute(config.uploadDir) ? config.uploadDir : path.join(__dirname, '..', config.uploadDir);

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadDir));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customSiteTitle: 'MedVehicule API',
  customCss: '.swagger-ui .topbar { display: none }',
}));

app.use('/api/auth', authRouter);
app.use('/api/hospitals', hospitalsRouter);
app.use('/api/vehicle-types', vehicleTypesRouter);
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/users', usersRouter);
app.use('/api/authorizations', authorizationsRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/photos', photosRouter);
app.use('/api/problem-reports', problemReportsRouter);
app.use('/api/odometer', odometerRouter);
app.use('/api/maintenance', maintenanceRouter);
app.use('/api/assistance', assistanceRouter);
app.use('/api/interventions', interventionsRouter);
app.use('/api/vehicle3d', vehicle3dRouter);

app.use((err, req, res, next) => {
  if (err.message && (err.message.includes('Type de fichier') || err.message.includes('Format 3D'))) {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur' });
});

app.listen(config.port, () => {
  console.log(`MedVehicule API écoute sur http://localhost:${config.port}`);
});
