import Datastore from 'nedb-promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lightweight embedded DB files
export const usersDb = Datastore.create({
  filename: path.join(__dirname, '../../db/users.db'),
  autoload: true,
  timestampData: true,
});

export const otpsDb = Datastore.create({
  filename: path.join(__dirname, '../../db/otps.db'),
  autoload: true,
  timestampData: true,
});