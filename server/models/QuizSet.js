/**
 * @fileoverview QuizSet Mongoose Schema.
 * Stores quiz templates (name and list of questions) that survive room closures.
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

const QuizSetSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  questions: [QuestionSchema],
}, { timestamps: true });

module.exports = mongoose.model('QuizSet', QuizSetSchema);
