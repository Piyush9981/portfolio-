const env = require('../config/env');

function adminAuth(req, res, next) {
  const apiKey = req.headers['x-admin-key'] || req.query.adminKey;

  if (!apiKey || apiKey !== env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing administrative key' });
  }

  next();
}

module.exports = adminAuth;
