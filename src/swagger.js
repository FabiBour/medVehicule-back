import yaml from 'js-yaml';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const spec = yaml.load(readFileSync(join(__dirname, 'swagger.yaml'), 'utf8'));
export const swaggerDocument = spec;
