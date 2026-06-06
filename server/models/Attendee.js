/**
 * @fileoverview Attendee Mongoose Schema.
 * Represents a guest who has joined or previously joined a session.
 */
const mongoose = require('mongoose');

const AttendeeSchema = new mongoose.Schema({
  /** UUID generated client-side and stored in localStorage for session persistence */
  guestId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  name: { type: String, required: true, trim: true },
  /** The seed string used by boring-avatars to deterministically render the avatar */
  avatarSeed: { type: String, required: true },
  /** The room this attendee belongs to */
  roomCode: { type: String, required: true, uppercase: true },
  /** Whether this attendee's socket is currently connected */
  isOnline: { type: Boolean, default: true },
  /** Current understanding status for the confusion meter */
  understandingStatus: {
    type: String,
    enum: ['fine', 'lost'],
    default: 'fine',
  },
  /** Ephermeral socket ID for targeted emissions (buzz, etc.) */
  socketId: { type: String, default: null },
  /** Handraise feature fields */
  isHandRaised: { type: Boolean, default: false },
  handRaiseQuestion: { type: String, default: '' },
  joinedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Attendee', AttendeeSchema);
