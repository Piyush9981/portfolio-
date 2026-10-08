const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const env = {
  PORT: process.env.PORT || 4000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_ORIGIN: (process.env.FRONTEND_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000,http://127.0.0.1:5500').split(',').map(s => s.trim()),
  DATABASE_URL: process.env.DATABASE_URL || '',
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
  GITHUB_USERNAME: process.env.GITHUB_USERNAME || 'Piyush9981',
  CLASSWORK_REPO_NAME: process.env.CLASSWORK_REPO_NAME || 'bsc-it-classwork',
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || '',
  ADMIN_API_KEY: process.env.ADMIN_API_KEY || 'default_admin_key'
};

module.exports = env;
