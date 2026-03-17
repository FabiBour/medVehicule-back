import { config } from './config.js';
import { app } from './app.js';

app.listen(config.port, () => {
  console.log(`MedVehicule API écoute sur http://localhost:${config.port}`);
});
