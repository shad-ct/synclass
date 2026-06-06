/**
 * @fileoverview Resource upload REST routes using multer.
 * POST /api/resources/:roomCode — Upload a file and store its metadata in MongoDB.
 * GET  /api/resources/:roomCode — List all resources for a room.
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Resource = require('../models/Resource');
const Session = require('../models/Session');

/**
 * Configure multer disk storage.
 * Files are saved to /uploads/sessions/:roomCode/ with original extension preserved.
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'sessions', req.params.roomCode);
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

/**
 * POST /api/resources/:roomCode
 * Accepts a multipart/form-data file upload and persists metadata.
 * @body {File} file — the uploaded file
 * @body {string} description — optional human-readable description
 */
router.post('/:roomCode', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const { roomCode } = req.params;
    const serverPath = req.file.path;
    const publicUrl = `/uploads/sessions/${roomCode}/${req.file.filename}`;

    const resource = await Resource.create({
      roomCode: roomCode.toUpperCase(),
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      serverPath,
      publicUrl,
      description: req.body.description || '',
      sizeBytes: req.file.size,
    });

    // Add reference to session document
    await Session.updateOne(
      { roomCode: roomCode.toUpperCase() },
      { $push: { resources: resource._id } }
    );

    return res.status(201).json({
      success: true,
      resource: {
        id: resource._id,
        originalName: resource.originalName,
        mimeType: resource.mimeType,
        publicUrl: resource.publicUrl,
        description: resource.description,
        sizeBytes: resource.sizeBytes,
        uploadedAt: resource.uploadedAt,
      },
    });
  } catch (err) {
    console.error('[resource.routes] POST /:roomCode:', err.message);
    return res.status(500).json({ success: false, error: 'Upload failed' });
  }
});

/**
 * GET /api/resources/:roomCode
 * Returns all resources uploaded in a session.
 */
router.get('/:roomCode', async (req, res) => {
  try {
    const resources = await Resource.find(
      { roomCode: req.params.roomCode.toUpperCase() },
      { serverPath: 0 } // exclude disk path from client response
    ).sort({ uploadedAt: -1 });

    return res.json({ success: true, resources });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
