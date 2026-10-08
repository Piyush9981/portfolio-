const crypto = require('crypto');
const env = require('../config/env');

function verifyWebhook(req, res, next) {
  if (!env.WEBHOOK_SECRET) {
    console.warn('[Webhook Warning] WEBHOOK_SECRET is not configured. Rejecting request.');
    return res.status(500).json({ error: 'Webhook secret is not configured on server' });
  }

  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    return res.status(401).json({ error: 'Missing X-Hub-Signature-256 header' });
  }

  const hmac = crypto.createHmac('sha256', env.WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(req.rawBody || JSON.stringify(req.body)).digest('hex');

  const trusted = Buffer.from(digest, 'ascii');
  const untrusted = Buffer.from(signature, 'ascii');

  if (trusted.length !== untrusted.length || !crypto.timingSafeEqual(trusted, untrusted)) {
    console.error('[Webhook Error] HMAC signature verification failed');
    return res.status(403).json({ error: 'Invalid webhook signature' });
  }

  next();
}

module.exports = verifyWebhook;
