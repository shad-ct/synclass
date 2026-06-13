/**
 * @fileoverview Session REST routes.
 * POST /api/sessions   — Create a new room
 * GET  /api/sessions/:roomCode — Validate a room exists and is active
 */
const express = require('express');
const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const { customAlphabet } = require('nanoid');
const Session = require('../models/Session');
const Resource = require('../models/Resource');
const Attendee = require('../models/Attendee');
const QuizData = require('../models/QuizData');

// Generate a 6-character uppercase alphanumeric room code
const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

function serializePoll(poll) {
  if (!poll) return null;

  const optionCounts = Array(poll.options.length).fill(0);
  for (const response of poll.responses || []) {
    if (response.optionIndex >= 0 && response.optionIndex < optionCounts.length) {
      optionCounts[response.optionIndex] += 1;
    }
  }

  return {
    id: poll._id,
    question: poll.question,
    options: poll.options,
    isActive: poll.isActive,
    createdAt: poll.createdAt,
    closedAt: poll.closedAt,
    responseCount: (poll.responses || []).length,
    optionCounts,
  };
}

/**
 * POST /api/sessions
 * Creates a new session with a unique room code.
 * @returns {{ roomCode: string, sessionId: string }}
 */
router.post('/', async (req, res) => {
  try {
    let roomCode;
    let exists = true;

    // Collision-safe code generation loop
    while (exists) {
      roomCode = nanoid();
      exists = await Session.exists({ roomCode });
    }

    const session = await Session.create({ roomCode });

    return res.status(201).json({
      success: true,
      roomCode: session.roomCode,
      sessionId: session._id,
    });
  } catch (err) {
    console.error('[session.routes] POST /:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to create session' });
  }
});

/**
 * GET /api/sessions/:roomCode
 * Validates that a room exists and is currently active.
 * Used by the JoinSession page to verify before emitting join_room.
 */
router.get('/:roomCode', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const session = await Session.findOne(
      { roomCode: roomCode.toUpperCase() },
      { roomCode: 1, isActive: 1, isFrozen: 1, _id: 1 }
    );

    if (!session) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    if (!session.isActive) {
      return res.status(410).json({ success: false, error: 'Room has ended' });
    }

    return res.json({ success: true, session });
  } catch (err) {
    console.error('[session.routes] GET /:roomCode:', err.message);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * PATCH /api/sessions/:roomCode/close
 * Host closes the session.
 */
router.patch('/:roomCode/close', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const code = roomCode.toUpperCase();

    // 1. Delete all uploaded files on disk
    try {
      const uploadDir = path.join(__dirname, '..', 'uploads', 'sessions', code);
      if (fs.existsSync(uploadDir)) {
        fs.rmSync(uploadDir, { recursive: true, force: true });
        console.log(`[cleanup] Deleted files directory for room ${code}`);
      }
    } catch (fileErr) {
      console.error(`[cleanup] Failed to delete files directory for room ${code}:`, fileErr.message);
    }

    // 2. Delete all MongoDB objects for this session
    const session = await Session.findOne({ roomCode: code });
    if (session) {
      await Attendee.deleteMany({ roomCode: code });
      await Resource.deleteMany({ roomCode: code });
      await QuizData.deleteMany({ roomCode: code });
      await Session.deleteOne({ roomCode: code });
      console.log(`[cleanup] Flushed all database objects for room ${code}`);
    }

    // 3. Emit session_ended to attendees and clear in-memory state
    const { closeRoom } = require('../socket/socketController');
    closeRoom(code);

    return res.json({ success: true });
  } catch (err) {
    console.error('[session.routes] PATCH /close error:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * GET /api/sessions/:roomCode/host-state
 * Fetches the full active state of the session for a re-connecting host.
 */
router.get('/:roomCode/host-state', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const session = await Session.findOne({ roomCode: roomCode.toUpperCase() })
      .populate('resources')
      .populate('quizzes');

    if (!session) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    const latestQuiz = session.quizzes[session.quizzes.length - 1];
    const latestPoll = session.polls && session.polls.length > 0
      ? session.polls[session.polls.length - 1]
      : null;

    return res.json({
      success: true,
      broadcasts: session.broadcasts || [],
      isFrozen: session.isFrozen,
      resources: (session.resources || []).map((r) => ({
        id: r._id,
        originalName: r.originalName,
        mimeType: r.mimeType,
        publicUrl: r.publicUrl,
        description: r.description,
        sizeBytes: r.sizeBytes,
        uploadedAt: r.uploadedAt,
      })),
      quiz: latestQuiz
        ? {
            id: latestQuiz._id,
            questions: latestQuiz.questions,
            questionCount: latestQuiz.questions.length,
            activeQuestionIndex: latestQuiz.activeQuestionIndex,
            scores: latestQuiz.scores || [],
            askedQuestions: [...new Set((latestQuiz.responses || []).map(r => r.questionIndex))],
          }
        : null,
      poll: serializePoll(latestPoll),
    });
  } catch (err) {
    console.error('[session.routes] GET /host-state error:', err.message);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
