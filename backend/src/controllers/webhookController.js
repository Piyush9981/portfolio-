const syncQueueWorker = require('../services/syncQueueWorker');

const webhookController = {
  /**
   * POST /api/webhooks/github
   */
  async handleWebhook(req, res) {
    const deliveryId = req.headers['x-github-delivery'] || `manual-${Date.now()}`;
    const eventType = req.headers['x-github-event'] || 'push';
    const payload = req.body || {};
    const repoName = payload.repository?.name || null;

    console.log(`[Webhook Ingest] Received '${eventType}' event (Delivery: ${deliveryId}) for repo '${repoName}'`);

    try {
      const jobId = await syncQueueWorker.enqueueJob({
        deliveryId,
        eventType,
        repoName,
        payloadSummary: {
          action: payload.action || null,
          ref: payload.ref || null,
          sender: payload.sender?.login || null,
          commits_count: payload.commits ? payload.commits.length : 0,
        },
      });

      return res.status(202).json({
        success: true,
        message: 'Webhook acknowledged and enqueued for durable processing',
        jobId,
        deliveryId,
      });
    } catch (err) {
      console.error('[Webhook Ingest Error]', err);
      return res.status(500).json({ success: false, error: 'Failed to enqueue sync job' });
    }
  },
};

module.exports = webhookController;
