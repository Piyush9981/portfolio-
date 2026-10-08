const db = require('../config/database');
const projectSyncEngine = require('./projectSyncEngine');
const classworkSyncEngine = require('./classworkSyncEngine');
const env = require('../config/env');

let isProcessing = false;

const syncQueueWorker = {
  /**
   * Enqueue a sync job into PostgreSQL with delivery deduplication.
   */
  async enqueueJob({ deliveryId, eventType, repoName, payloadSummary }) {
    const query = `
      INSERT INTO sync_jobs (delivery_id, event_type, repository_name, payload_summary, status)
      VALUES ($1, $2, $3, $4, 'PENDING')
      ON CONFLICT (delivery_id) DO NOTHING
      RETURNING id;
    `;
    const res = await db.query(query, [deliveryId, eventType, repoName, payloadSummary || {}]);
    
    // Trigger worker loop
    setImmediate(() => this.processNextJob());
    return res.rows[0] ? res.rows[0].id : null;
  },

  /**
   * Process next pending job from the database using row-level locking.
   */
  async processNextJob() {
    let client;
    try {
      client = await db.getClient();
    } catch (connErr) {
      console.warn('[SyncWorker] Database not yet reachable:', connErr.message);
      isProcessing = false;
      return;
    }

    let job = null;
    try {
      await client.query('BEGIN');

      // Claim oldest pending job with SKIP LOCKED
      const claimQuery = `
        SELECT id, event_type, repository_name, attempts, max_attempts
        FROM sync_jobs
        WHERE status = 'PENDING'
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED;
      `;
      const res = await client.query(claimQuery);

      if (res.rows.length === 0) {
        await client.query('COMMIT');
        isProcessing = false;
        return;
      }

      job = res.rows[0];
      await client.query(
        "UPDATE sync_jobs SET status = 'PROCESSING', locked_at = NOW(), attempts = attempts + 1 WHERE id = $1",
        [job.id]
      );
      await client.query('COMMIT');

      const startTime = Date.now();
      console.log(`[SyncWorker] Processing Job #${job.id} (${job.event_type} on ${job.repository_name})...`);

      try {
        let result = null;

        if (job.event_type === 'MANUAL_FULL' || job.event_type === 'BOOT_REBUILD') {
          const pRes = await projectSyncEngine.syncAllProjects();
          const cRes = await classworkSyncEngine.syncClassworkRepository();
          result = { projects: pRes, classwork: cRes };
        } else if (job.event_type === 'MANUAL_PROJECTS') {
          result = await projectSyncEngine.syncAllProjects();
        } else if (job.event_type === 'MANUAL_CLASSWORK' || job.repository_name === env.CLASSWORK_REPO_NAME) {
          result = await classworkSyncEngine.syncClassworkRepository();
        } else if (job.repository_name) {
          result = await projectSyncEngine.syncSingleRepository(env.GITHUB_USERNAME, job.repository_name);
        } else {
          result = await projectSyncEngine.syncAllProjects();
        }

        const duration = Date.now() - startTime;
        await db.query(
          "UPDATE sync_jobs SET status = 'SUCCESS', duration_ms = $1, updated_at = NOW() WHERE id = $2",
          [duration, job.id]
        );
        console.log(`[SyncWorker] Job #${job.id} completed successfully in ${duration}ms.`);
      } catch (err) {
        const duration = Date.now() - startTime;
        const newStatus = job.attempts >= job.max_attempts ? 'FAILED' : 'PENDING';
        await db.query(
          "UPDATE sync_jobs SET status = $1, error_message = $2, duration_ms = $3, updated_at = NOW() WHERE id = $4",
          [newStatus, err.message || String(err), duration, job.id]
        );
        console.error(`[SyncWorker] Job #${job.id} failed:`, err.message);
      }
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      console.error('[SyncWorker Fatal Error]', err.message || err);
    } finally {
      if (client) client.release();
      isProcessing = false;
      // Only check again immediately if a job was just completed
      if (job) {
        setTimeout(() => this.processNextJob(), 500);
      }
    }
  },
};

module.exports = syncQueueWorker;
