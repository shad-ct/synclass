/**
 * @fileoverview Resource Mongoose Schema.
 * Stores file metadata for uploads shared with the audience.
 */
const mongoose = require('mongoose');

const ResourceSchema = new mongoose.Schema({
  /** The session room this resource was shared in */
  roomCode: { type: String, required: true, uppercase: true },
  /** Original filename as provided by the uploader */
  originalName: { type: String, required: true },
  /** MIME type (e.g., "application/pdf", "image/png") */
  mimeType: { type: String, required: true },
  /** Server-side disk path (relative to uploads dir) */
  serverPath: { type: String, required: true },
  /** Publicly accessible URL served via Express static */
  publicUrl: { type: String, required: true },
  /** Human-readable description added by host (optional) */
  description: { type: String, default: '' },
  /** File size in bytes */
  sizeBytes: { type: Number, default: 0 },
  uploadedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Resource', ResourceSchema);
