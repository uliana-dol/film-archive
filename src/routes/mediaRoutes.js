const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');
const { verifyToken } = require('../controllers/authController');

router.get('/', verifyToken, mediaController.getAllMedia);
router.post('/', verifyToken, mediaController.addMedia);
router.put('/:id', verifyToken, mediaController.updateMedia);
router.delete('/:id', verifyToken, mediaController.deleteMedia);

module.exports = router;
