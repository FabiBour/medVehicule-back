import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..', '..');
const uploadDir = path.isAbsolute(config.uploadDir) ? config.uploadDir : path.join(rootDir, config.uploadDir);

try {
  fs.mkdirSync(path.join(uploadDir, 'photos'), { recursive: true });
  fs.mkdirSync(path.join(uploadDir, 'models3d'), { recursive: true });
} catch (e) {
  // ignore
}

const storagePhotos = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(uploadDir, 'photos')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const storage3D = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(uploadDir, 'models3d')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.glb';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const imageFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Type de fichier non autorisé (images uniquement)'), false);
};

const model3DFilter = (req, file, cb) => {
  const allowed = ['model/gltf-binary', 'model/gltf+json', 'application/octet-stream'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(file.mimetype) || ['.glb', '.gltf'].includes(ext)) cb(null, true);
  else cb(new Error('Format 3D non autorisé (glb/gltf attendu)'), false);
};

export const uploadPhoto = multer({
  storage: storagePhotos,
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const uploadModel3D = multer({
  storage: storage3D,
  fileFilter: model3DFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});

/** Retourne l'URL relative pour servir le fichier (ex: /uploads/photos/xxx.jpg) */
export function getUploadUrl(relativePath) {
  if (!relativePath) return null;
  const normalized = relativePath.replace(/\\/g, '/');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

export function getUploadFullPath(relativePath) {
  return path.join(uploadDir, relativePath.replace(/^\//, '').replace(/^uploads\/?/, ''));
}
