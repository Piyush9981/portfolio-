const express = require('express');
const apiController = require('../controllers/apiController');

const router = express.Router();

router.get('/projects', apiController.getProjects);
router.get('/classwork', apiController.getClasswork);
router.get('/classwork/download/:id', apiController.downloadClassworkFile);

module.exports = router;
