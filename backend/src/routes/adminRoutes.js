const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const syncQueueWorker = require('../services/syncQueueWorker');
const apiController = require('../controllers/apiController');

const router = express.Router();

router.use(adminAuth);

router.post('/sync/full', async (req, res) => {
  const deliveryId = `admin-full-${Date.now()}`;
  const jobId = await syncQueueWorker.enqueueJob({
    deliveryId,
    eventType: 'MANUAL_FULL',
    repoName: 'ALL',
    payloadSummary: { triggered_by: 'ADMIN' },
  });
  return res.status(202).json({ success: true, message: 'Full sync enqueued', jobId });
});

router.post('/sync/projects', async (req, res) => {
  const deliveryId = `admin-projects-${Date.now()}`;
  const jobId = await syncQueueWorker.enqueueJob({
    deliveryId,
    eventType: 'MANUAL_PROJECTS',
    repoName: 'ALL_PROJECTS',
    payloadSummary: { triggered_by: 'ADMIN' },
  });
  return res.status(202).json({ success: true, message: 'Projects sync enqueued', jobId });
});

router.post('/sync/classwork', async (req, res) => {
  const deliveryId = `admin-classwork-${Date.now()}`;
  const jobId = await syncQueueWorker.enqueueJob({
    deliveryId,
    eventType: 'MANUAL_CLASSWORK',
    repoName: 'CLASSWORK',
    payloadSummary: { triggered_by: 'ADMIN' },
  });
  return res.status(202).json({ success: true, message: 'Classwork sync enqueued', jobId });
});

router.get('/sync/status', apiController.getSyncStatus);

module.exports = router;
