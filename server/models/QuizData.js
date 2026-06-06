/**
 * @fileoverview QuizData Mongoose Schema.
 * Stores quiz questions, per-attendee responses, and final scores for a session.
 */
const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  /** Array of 2-4 answer options */
  options: [{ type: String, required: true }],
  /** Zero-based index of the correct option */
  correctIndex: { type: Number, required: true },
  /** Time allowed to answer in seconds */
  timeLimit: { type: Number, default: 20 },
});

const ResponseSchema = new mongoose.Schema({
  questionIndex: { type: Number, required: true },
  attendeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendee' },
  guestId: { type: String, required: true },
  name: { type: String, required: true },
  /** Zero-based index of the chosen option */
  selectedOption: { type: Number, required: true },
  /** How long in milliseconds it took to answer from question_start */
  responseTimeMs: { type: Number, required: true },
  isCorrect: { type: Boolean, required: true },
  /** Speed-weighted points: base 1000, reduced by time ratio */
  pointsAwarded: { type: Number, default: 0 },
});

const ScoreSchema = new mongoose.Schema({
  guestId: { type: String, required: true },
  name: { type: String, required: true },
  avatarSeed: { type: String },
  totalPoints: { type: Number, default: 0 },
  correctAnswers: { type: Number, default: 0 },
  rank: { type: Number, default: 0 },
});

const QuizDataSchema = new mongoose.Schema({
  /** Reference to the parent session */
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
  },
  roomCode: { type: String, required: true },
  questions: [QuestionSchema],
  responses: [ResponseSchema],
  /** Final sorted leaderboard — persisted after each question_end */
  scores: [ScoreSchema],
  /** Index of currently active question (-1 = none) */
  activeQuestionIndex: { type: Number, default: -1 },
  startedAt: { type: Date },
  completedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('QuizData', QuizDataSchema);
