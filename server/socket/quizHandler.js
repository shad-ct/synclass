/**
 * @fileoverview Kahoot-style quiz game loop engine.
 *
 * Game Loop Flow:
 * 1. Host emits `create_quiz` → server saves QuizData to MongoDB
 * 2. Host emits `launch_question` → server broadcasts `question_start` + starts countdown
 * 3. Every second: server emits `time_tick` to all room members
 * 4. Attendees emit `submit_answer` → server validates and calculates speed-weighted points
 * 5. On timeout (or all answered): server emits `question_end` + `show_results`
 * 6. Host can `launch_question` for the next index
 */
const QuizData = require('../models/QuizData');
const Session = require('../models/Session');

/** Max points per question (Kahoot-style: speed bonus from 0-1000) */
const MAX_POINTS = 1000;

/**
 * create_quiz — Host saves quiz questions to DB and links to session.
 * @param {{ roomCode: string, questions: Array }} payload
 */
async function handleCreateQuiz(io, socket, payload, rooms) {
  const { roomCode, questions } = payload;
  const code = roomCode.toUpperCase();
  const room = rooms.get(code);
  if (!room || room.hostSocketId !== socket.id) return;

  // Backend validation
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    socket.emit('quiz_error', { message: 'Quiz must have at least one question.' });
    return;
  }

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.text || !q.text.trim()) {
      socket.emit('quiz_error', { message: `Question ${i + 1} must have a question title.` });
      return;
    }
    if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
      socket.emit('quiz_error', { message: `Question ${i + 1} must have at least 2 options.` });
      return;
    }
    if (q.options.some(opt => !opt || !opt.trim())) {
      socket.emit('quiz_error', { message: `All options for Question ${i + 1} must have text.` });
      return;
    }
    if (q.correctIndex === undefined || q.correctIndex < 0 || q.correctIndex >= q.options.length) {
      socket.emit('quiz_error', { message: `Question ${i + 1} must specify a valid correct option.` });
      return;
    }
  }

  try {
    const session = await Session.findOne({ roomCode: code });
    if (!session) {
      socket.emit('quiz_error', { message: 'Session not found' });
      return;
    }

    const quizDoc = await QuizData.create({
      sessionId: session._id,
      roomCode: code,
      questions,
      responses: [],
      scores: [],
      activeQuestionIndex: -1,
      startedAt: new Date(),
    });

    // Link quiz to session
    await Session.updateOne(
      { roomCode: code },
      { $push: { quizzes: quizDoc._id } }
    );

    // Initialize quiz state in memory
    room.quizState = {
      quizId: quizDoc._id.toString(),
      questions,
      activeIndex: -1,
      timer: null,
      secondsLeft: 0,
      questionStartTime: 0,
      responses: new Map(),
      scores: new Map(), // guestId → { name, totalPoints, correctAnswers }
      currentView: 'lobby',
    };

    socket.emit('quiz_created', {
      quizId: quizDoc._id,
      questionCount: questions.length,
    });

    console.log(`[quiz] Quiz created for room ${code}: ${questions.length} questions`);
  } catch (err) {
    console.error('[quiz] handleCreateQuiz error:', err.message);
    socket.emit('quiz_error', { message: 'Failed to create quiz' });
  }
}

/**
 * launch_question — Host starts a specific question's countdown.
 * @param {{ roomCode: string, questionIndex: number }} payload
 */
function handleLaunchQuestion(io, socket, payload, rooms) {
  const { roomCode, questionIndex } = payload;
  const code = roomCode.toUpperCase();
  const room = rooms.get(code);
  if (!room || !room.quizState) return;
  const isAuthorized = room.hostSocketId === socket.id || socket.rooms.has(`host:${code}`);
  if (!isAuthorized) return;

  const qs = room.quizState;

  // Cancel any existing timer
  if (qs.timer) {
    clearInterval(qs.timer);
    qs.timer = null;
  }

  const question = qs.questions[questionIndex];
  if (!question) {
    socket.emit('quiz_error', { message: 'Question not found' });
    return;
  }

  qs.activeIndex = questionIndex;
  qs.secondsLeft = question.timeLimit || 20;
  qs.questionStartTime = Date.now();
  qs.responses = new Map(); // clear for this question
  qs.currentView = 'question';

  // Broadcast question to room (WITHOUT correctIndex!)
  const questionPayload = {
    questionIndex,
    text: question.text,
    options: question.options,
    timeLimit: question.timeLimit || 20,
    secondsLeft: qs.secondsLeft,
  };

  io.to(`room:${code}`).emit('question_start', questionPayload);
  console.log(`[quiz] Room ${code} — Q${questionIndex}: "${question.text}"`);

  // Start countdown ticker
  qs.timer = setInterval(() => {
    qs.secondsLeft -= 1;
    io.to(`room:${code}`).emit('time_tick', {
      secondsLeft: qs.secondsLeft,
      questionIndex,
    });

    if (qs.secondsLeft <= 0) {
      endQuestion(io, code, room);
    }
  }, 1000);
}

/**
 * submit_answer — Attendee submits their answer during active question.
 * @param {{ roomCode: string, guestId: string, name: string, questionIndex: number, selectedOption: number }} payload
 */
async function handleSubmitAnswer(io, socket, payload, rooms) {
  const { roomCode, guestId, name, questionIndex, selectedOption } = payload;
  const code = roomCode.toUpperCase();
  const room = rooms.get(code);
  if (!room || !room.quizState) return;

  const qs = room.quizState;

  // Reject late or duplicate submissions
  if (qs.activeIndex !== questionIndex) return;
  if (qs.responses.has(guestId)) return;

  const question = qs.questions[questionIndex];
  const responseTimeMs = Date.now() - qs.questionStartTime;
  const isCorrect = selectedOption === question.correctIndex;

  // Speed-weighted scoring: full points for instant answer, 0 for time-limit
  const timeLimitMs = (question.timeLimit || 20) * 1000;
  const speedRatio = Math.max(0, 1 - responseTimeMs / timeLimitMs);
  const pointsAwarded = isCorrect ? Math.round(MAX_POINTS * speedRatio) : 0;

  qs.responses.set(guestId, {
    selectedOption,
    responseTimeMs,
    isCorrect,
    pointsAwarded,
  });

  // Update running scores
  const attendee = room.attendees.get(guestId);
  const avatarSeed = attendee ? attendee.avatarSeed : '';
  const existing = qs.scores.get(guestId) || { name, avatarSeed, totalPoints: 0, correctAnswers: 0 };
  existing.totalPoints += pointsAwarded;
  existing.correctAnswers += isCorrect ? 1 : 0;
  qs.scores.set(guestId, existing);

  // Send simple submission confirmation back to this attendee (not containing correctness!)
  socket.emit('answer_received', {
    hasAnswered: true,
  });

  // Broadcast the running response count to the room so both host & presenter see it live
  io.to(`room:${code}`).emit('answer_submitted_update', {
    count: qs.responses.size,
    totalAttendees: room.attendees.size,
  });

  // If everyone answered, end early
  const roomAttendeeCount = room.attendees.size;
  if (qs.responses.size >= roomAttendeeCount && roomAttendeeCount > 0) {
    endQuestion(io, code, room);
  }
}

/**
 * Ends the current question, broadcasts results, and persists to MongoDB.
 * Called by timer expiry OR when all attendees have answered.
 * @param {import('socket.io').Server} io
 * @param {string} code - roomCode
 * @param {object} room
 */
async function endQuestion(io, code, room) {
  const qs = room.quizState;
  if (!qs || qs.activeIndex < 0) return;

  // Prevent double-call
  if (qs.timer) {
    clearInterval(qs.timer);
    qs.timer = null;
  }

  const questionIndex = qs.activeIndex;
  qs.activeIndex = -1;
  qs.currentView = 'results';
  qs.lastQuestionIndex = questionIndex;

  const question = qs.questions[questionIndex];
  // Calculate answer distribution (option counts)
  const optionCounts = Array(question.options.length).fill(0);
  for (const resp of qs.responses.values()) {
    if (resp.selectedOption >= 0 && resp.selectedOption < optionCounts.length) {
      optionCounts[resp.selectedOption]++;
    }
  }
  qs.optionCounts = optionCounts;

  // Build sorted leaderboard
  const leaderboard = buildLeaderboard(qs.scores);

  // Assign ranks (handling ties)
  assignRanks(leaderboard);

  // Send individual result to each attendee in the room
  for (const [guestId, attendee] of room.attendees.entries()) {
    if (attendee && attendee.socketId) {
      const resp = qs.responses.get(guestId);
      const existing = qs.scores.get(guestId);
      const entry = leaderboard.find((e) => e.guestId === guestId);
      const rank = entry ? entry.rank : 0;

      io.to(attendee.socketId).emit('answer_received', {
        isCorrect: resp ? resp.isCorrect : false,
        pointsAwarded: resp ? resp.pointsAwarded : 0,
        correctIndex: question.correctIndex,
        currentTotal: existing ? existing.totalPoints : 0,
        rank: rank || 0,
        totalPlayers: leaderboard.length,
      });
    }
  }

  // Broadcast question_end with correct answer, leaderboard, and option counts
  io.to(`room:${code}`).emit('question_end', {
    questionIndex,
    correctIndex: question.correctIndex,
    leaderboard: leaderboard.slice(0, 10), // top 10
    totalResponses: qs.responses.size,
    totalAttendees: room.attendees.size,
    optionCounts,
  });

  console.log(`[quiz] Room ${code} Q${questionIndex} ended. ${qs.responses.size} responses.`);

  // Auto-transition to leaderboard (or podium if final question) after 5 seconds
  setTimeout(() => {
    // Re-verify room state is active and matches current quiz ID
    if (room && room.quizState && room.quizState.quizId === qs.quizId) {
      const isLastQuestion = questionIndex === qs.questions.length - 1;
      if (isLastQuestion) {
        room.quizState.currentView = 'podium';
        const finalLeaderboard = buildLeaderboard(room.quizState.scores);
        assignRanks(finalLeaderboard);

        io.to(`room:${code}`).emit('show_podium', {
          leaderboard: finalLeaderboard.slice(0, 3),
        });
        console.log(`[quiz] Room ${code} — Final Podium automatically displayed`);
      } else {
        room.quizState.currentView = 'scoreboard';
        const currentLeaderboard = buildLeaderboard(room.quizState.scores);
        assignRanks(currentLeaderboard);

        io.to(`room:${code}`).emit('show_scoreboard', {
          leaderboard: currentLeaderboard.slice(0, 10),
        });
        console.log(`[quiz] Room ${code} — Leaderboard automatically displayed`);
      }
    }
  }, 5000);

  // Persist responses to MongoDB
  try {
    const responseDocs = [...qs.responses.entries()].map(([guestId, resp]) => ({
      questionIndex,
      guestId,
      name: qs.scores.get(guestId)?.name || guestId,
      ...resp,
    }));

    const scoreDocs = leaderboard.map((entry) => ({
      guestId: entry.guestId,
      name: entry.name,
      avatarSeed: entry.avatarSeed,
      totalPoints: entry.totalPoints,
      correctAnswers: entry.correctAnswers,
      rank: entry.rank,
    }));

    await QuizData.updateOne(
      { _id: qs.quizId },
      {
        $push: { responses: { $each: responseDocs } },
        $set: { scores: scoreDocs, activeQuestionIndex: -1 },
      }
    );
  } catch (err) {
    console.error('[quiz] endQuestion persist error:', err.message);
  }
}

/**
 * Converts the scores Map to a sorted leaderboard array.
 * @param {Map} scoresMap
 * @returns {Array}
 */
function buildLeaderboard(scoresMap) {
  return [...scoresMap.entries()]
    .map(([guestId, data]) => ({ guestId, ...data }))
    .sort((a, b) => b.totalPoints - a.totalPoints);
}

/**
 * reset_quiz — Host clears and resets current quiz state.
 * @param {{ roomCode: string }} payload
 */
async function handleResetQuiz(io, socket, payload, rooms) {
  const { roomCode } = payload;
  const code = roomCode.toUpperCase();
  const room = rooms.get(code);
  if (!room || room.hostSocketId !== socket.id) return;

  // Clear running timer if active
  if (room.quizState && room.quizState.timer) {
    clearInterval(room.quizState.timer);
  }
  room.quizState = null;

  // Broadcast quiz_reset to the room (attendees and presenter)
  io.to(`room:${code}`).emit('quiz_reset');

  try {
    const session = await Session.findOne({ roomCode: code });
    if (session) {
      await QuizData.deleteMany({ sessionId: session._id });
      session.quizzes = [];
      await session.save();
    }
    socket.emit('quiz_reset_confirmed');
    console.log(`[quiz] Quiz reset and cleared for room ${code}`);
  } catch (err) {
    console.error('[quiz] handleResetQuiz error:', err.message);
    socket.emit('quiz_error', { message: 'Failed to reset quiz' });
  }
}

/**
 * host_show_scoreboard — Presenter triggers the presentation screen to display the leaderboard.
 */
function handleShowScoreboard(io, socket, payload, rooms) {
  const { roomCode } = payload;
  const code = roomCode.toUpperCase();
  const room = rooms.get(code);
  if (!room || !room.quizState) return;
  const isAuthorized = room.hostSocketId === socket.id || socket.rooms.has(`host:${code}`);
  if (!isAuthorized) return;

  room.quizState.currentView = 'scoreboard';
  const leaderboard = buildLeaderboard(room.quizState.scores);
  assignRanks(leaderboard);

  io.to(`room:${code}`).emit('show_scoreboard', {
    leaderboard: leaderboard.slice(0, 10),
  });
  console.log(`[quiz] Room ${code} — Scoreboard displayed`);
}

/**
 * host_show_podium — Presenter triggers the presentation screen to display the final podium.
 */
function handleShowPodium(io, socket, payload, rooms) {
  const { roomCode } = payload;
  const code = roomCode.toUpperCase();
  const room = rooms.get(code);
  if (!room || !room.quizState) return;
  const isAuthorized = room.hostSocketId === socket.id || socket.rooms.has(`host:${code}`);
  if (!isAuthorized) return;

  room.quizState.currentView = 'podium';
  const leaderboard = buildLeaderboard(room.quizState.scores);
  assignRanks(leaderboard);

  io.to(`room:${code}`).emit('show_podium', {
    leaderboard: leaderboard.slice(0, 3),
  });
  console.log(`[quiz] Room ${code} — Final Podium displayed`);
}

/**
 * clear_leaderboard — Host resets all attendee scores to 0 in the active quiz.
 */
async function handleClearLeaderboard(io, socket, payload, rooms) {
  const { roomCode } = payload;
  const code = roomCode.toUpperCase();
  const room = rooms.get(code);
  if (!room || !room.quizState) return;
  const isAuthorized = room.hostSocketId === socket.id || socket.rooms.has(`host:${code}`);
  if (!isAuthorized) return;

  const qs = room.quizState;

  // Clear running scores Map
  qs.scores.clear();

  // Re-populate all room attendees with 0 points
  for (const [guestId, attendee] of room.attendees.entries()) {
    qs.scores.set(guestId, {
      name: attendee.name,
      avatarSeed: attendee.avatarSeed,
      totalPoints: 0,
      correctAnswers: 0,
    });
  }

  // Clear responses for current question
  qs.responses.clear();

  const clearedLeaderboard = buildLeaderboard(qs.scores);
  assignRanks(clearedLeaderboard);

  // Broadcast updated leaderboard to room
  io.to(`room:${code}`).emit('leaderboard_cleared', {
    leaderboard: clearedLeaderboard,
  });

  // Persist cleared scores to DB
  try {
    await QuizData.updateOne(
      { _id: qs.quizId },
      {
        $set: { scores: [], responses: [] }
      }
    );
  } catch (err) {
    console.error('[quiz] handleClearLeaderboard DB error:', err.message);
  }

  console.log(`[quiz] Leaderboard cleared/reset to 0 for room ${code}`);
}

function assignRanks(leaderboard) {
  let currentRank = 1;
  for (let i = 0; i < leaderboard.length; i++) {
    if (i > 0 && leaderboard[i].totalPoints < leaderboard[i - 1].totalPoints) {
      currentRank = i + 1;
    }
    leaderboard[i].rank = currentRank;
  }
}

module.exports = {
  handleCreateQuiz,
  handleLaunchQuestion,
  handleSubmitAnswer,
  handleResetQuiz,
  handleShowScoreboard,
  handleShowPodium,
  handleClearLeaderboard,
  buildLeaderboard,
  assignRanks
};
