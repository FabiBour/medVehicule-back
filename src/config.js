import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  uploadDir: process.env.UPLOAD_DIR || './uploads',
};
