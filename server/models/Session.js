/**
 * @fileoverview Session Mongoose Schema.
 * Represents an active or completed presenter session / room.
 */
const mongoose = require('mongoose');

const AttendanceLogSchema = new mongoose.Schema({
  triggeredAt: { type: Date, default: Date.now },
  acknowledgedBy: [{
    attendeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendee' },
    guestId: String,
    name: String,
    timestamp: { type: Date, default: Date.now },
  }],
});

const BroadcastSchema = new mongoose.Schema({
  content: { type: String, required: true },
  type: { type: String, enum: ['text', 'code'], default: 'text' },
  sentAt: { type: Date, default: Date.now },
});

const PollResponseSchema = new mongoose.Schema({
  guestId: { type: String, required: true },
  name: { type: String, default: '' },
  optionIndex: { type: Number, required: true },
  answeredAt: { type: Date, default: Date.now },
}, { _id: false });

const PollSchema = new mongoose.Schema({
  question: { type: String, required: true, trim: true },
  options: [{ type: String, required: true, trim: true }],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  closedAt: { type: Date, default: null },
  responses: [PollResponseSchema],
});

const SessionSchema = new mongoose.Schema({
  /** Unique 6-character alphanumeric room code */
  roomCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    minlength: 6,
    maxlength: 6,
  },
  /** Socket ID of the host for direct targeted emissions */
  hostSocketId: { type: String, default: null },
  /** Whether the room is currently accepting attendees */
  isActive: { type: Boolean, default: true },
  /** Whether attendee screens are frozen */
  isFrozen: { type: Boolean, default: false },
  /** References to all attendees who have ever joined */
  attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Attendee' }],
  /** Log of all ad-hoc attendance pings */
  attendanceLogs: [AttendanceLogSchema],
  /** Text/code snippets broadcast during the session */
  broadcasts: [BroadcastSchema],
  /** References to quiz data documents for this session */
  quizzes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'QuizData' }],
  /** Ad-hoc live polls created during the session */
  polls: [PollSchema],
  /** References to resource files shared in this session */
  resources: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Resource' }],
}, { timestamps: true });

module.exports = mongoose.model('Session', SessionSchema);
