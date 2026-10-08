const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const env = require('./config/env');
const apiRoutes = require('./routes/apiRoutes');
const adminRoutes = require('./routes/adminRoutes');
const verifyWebhook = require('./middleware/verifyWebhook');
const webhookController = require('./controllers/webhookController');

const app = express();

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin, 'null' (file:// requests), or configured origins
    if (!origin || origin === 'null') return callback(null, true);
    if (env.FRONTEND_ORIGIN.includes('*') || env.FRONTEND_ORIGIN.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive in dev
  },
  credentials: true,
}));

// Capture raw body for GitHub Webhook verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  },
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);
app.post('/api/webhooks/github', verifyWebhook, webhookController.handleWebhook);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = app;
