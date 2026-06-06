/**
 * @fileoverview Quiz Set REST routes.
 * GET    /api/quizzes       — Fetch all saved quiz sets
 * POST   /api/quizzes       — Create a new quiz set
 * GET    /api/quizzes/:id   — Fetch a specific quiz set
 * PUT    /api/quizzes/:id   — Update a saved quiz set
 * DELETE /api/quizzes/:id   — Delete a saved quiz set
 */
const express = require('express');
const router = express.Router();
const QuizSet = require('../models/QuizSet');

// GET /api/quizzes — Fetch all saved quiz sets
router.get('/', async (req, res) => {
  try {
    const quizSets = await QuizSet.find({}).sort({ updatedAt: -1 });
    return res.json({ success: true, quizSets });
  } catch (err) {
    console.error('[quiz.routes] GET /:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve quiz sets' });
  }
});

// GET /api/quizzes/:id — Fetch a specific quiz set
router.get('/:id', async (req, res) => {
  try {
    const quizSet = await QuizSet.findById(req.params.id);
    if (!quizSet) {
      return res.status(404).json({ success: false, error: 'Quiz set not found' });
    }
    return res.json({ success: true, quizSet });
  } catch (err) {
    console.error('[quiz.routes] GET /:id:', err.message);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/quizzes — Create a new quiz set
router.post('/', async (req, res) => {
  try {
    const { title, questions } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one question is required' });
    }

    // Basic questions validation
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text || !q.text.trim()) {
        return res.status(400).json({ success: false, error: `Question ${i + 1} must have text.` });
      }
      if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
        return res.status(400).json({ success: false, error: `Question ${i + 1} must have at least 2 options.` });
      }
      if (q.correctIndex === undefined || q.correctIndex < 0 || q.correctIndex >= q.options.length) {
        return res.status(400).json({ success: false, error: `Question ${i + 1} must have a valid correct index.` });
      }
    }

    const quizSet = await QuizSet.create({
      title: title.trim(),
      questions,
    });

    return res.status(201).json({ success: true, quizSet });
  } catch (err) {
    console.error('[quiz.routes] POST /:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to create quiz set' });
  }
});

// PUT /api/quizzes/:id — Update a saved quiz set
router.put('/:id', async (req, res) => {
  try {
    const { title, questions } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one question is required' });
    }

    // Basic questions validation
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text || !q.text.trim()) {
        return res.status(400).json({ success: false, error: `Question ${i + 1} must have text.` });
      }
      if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
        return res.status(400).json({ success: false, error: `Question ${i + 1} must have at least 2 options.` });
      }
      if (q.correctIndex === undefined || q.correctIndex < 0 || q.correctIndex >= q.options.length) {
        return res.status(400).json({ success: false, error: `Question ${i + 1} must have a valid correct index.` });
      }
    }

    const quizSet = await QuizSet.findByIdAndUpdate(
      req.params.id,
      {
        title: title.trim(),
        questions,
      },
      { new: true }
    );

    if (!quizSet) {
      return res.status(404).json({ success: false, error: 'Quiz set not found' });
    }

    return res.json({ success: true, quizSet });
  } catch (err) {
    console.error('[quiz.routes] PUT /:id:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to update quiz set' });
  }
});

// DELETE /api/quizzes/:id — Delete a saved quiz set
router.delete('/:id', async (req, res) => {
  try {
    const quizSet = await QuizSet.findByIdAndDelete(req.params.id);
    if (!quizSet) {
      return res.status(404).json({ success: false, error: 'Quiz set not found' });
    }
    return res.json({ success: true, message: 'Quiz set deleted successfully' });
  } catch (err) {
    console.error('[quiz.routes] DELETE /:id:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to delete quiz set' });
  }
});

module.exports = router;
