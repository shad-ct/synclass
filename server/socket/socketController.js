/**
 * @fileoverview In-memory room state manager and Socket.io event router.
 *
 * The `rooms` Map is the single source of truth for all transient session state.
 * It is populated on room creation and cleared when the host disconnects.
 *
 * Room state shape:
 * {
 *   hostSocketId: string,
 *   sessionId: string (MongoDB ObjectId),
 *   isFrozen: boolean,
 *   attendees: Map<guestId, { socketId, name, avatarSeed, status: 'fine'|'lost' }>,
 *   confusionInterval: NodeJS.Timeout | null,
 *   quizState: {
 *     quizId: string,
 *     questions: QuestionSchema[],
 *     activeIndex: number,
 *     timer: NodeJS.Timeout | null,
 *     secondsLeft: number,
 *     questionStartTime: number,
 *     responses: Map<guestId, { selectedOption, responseTimeMs, isCorrect, pointsAwarded }>,
 *     scores: Map<guestId, { name, totalPoints, correctAnswers }>
 *   } | null
 * }
 */

const Session = require('../models/Session');
const Attendee = require('../models/Attendee');
const attendanceHandler = require('./attendanceHandler');
const quizHandler = require('./quizHandler');
const confusionHandler = require('./confusionHandler');
const broadcastHandler = require('./broadcastHandler');
const handraiseHandler = require('./handraiseHandler');
const { getRosterArray } = require('./socketUtils');

/** @type {Map<string, object>} roomCode → room state */
const rooms = new Map();

let ioInstance = null;

/**
 * Creates a fresh room state object.
 * @param {string} hostSocketId
 * @param {string} sessionId
 * @returns {object}
 */
function createRoomState(hostSocketId, sessionId) {
  return {
    hostSocketId,
    sessionId,
    isFrozen: false,
    attendees: new Map(),
    confusionInterval: null,
    quizState: null,
  };
}

/**
 * Initializes the Socket.io controller — called once from server.js.
 * @param {import('socket.io').Server} io
 */
function initSocketController(io) {
  ioInstance = io;
  io.on('connection', (socket) => {
    console.log(`[socket] connect: ${socket.id}`);

    // ─────────────────────────────────────────────
    // HOST: Register as room host
    // ─────────────────────────────────────────────
    socket.on('host_room', async ({ roomCode, sessionId }) => {
      const code = roomCode.toUpperCase();
      let room = rooms.get(code);

      try {
        const sessionDoc = await Session.findOne({ roomCode: code }).populate('quizzes');
        if (!sessionDoc) {
          console.error(`[socket] host_room failed: session not found in DB for code ${code}`);
          socket.emit('host_error', { message: 'Session not found in database' });
          return;
        }

        const actualSessionId = sessionId || sessionDoc._id.toString();

        if (!room) {
          room = createRoomState(socket.id, actualSessionId);
          rooms.set(code, room);
          confusionHandler.startConfusionBroadcast(io, code, rooms);
        } else {
          room.hostSocketId = socket.id;
        }

        // Restore quizState if there's a quiz in the DB and room.quizState is null
        if (sessionDoc.quizzes && sessionDoc.quizzes.length > 0 && !room.quizState) {
          const latestQuiz = sessionDoc.quizzes[sessionDoc.quizzes.length - 1];
          const responsesMap = new Map();
          (latestQuiz.responses || []).forEach(r => {
            responsesMap.set(r.guestId, {
              selectedOption: r.selectedOption,
              responseTimeMs: r.responseTimeMs,
              isCorrect: r.isCorrect,
              pointsAwarded: r.pointsAwarded
            });
          });

          const scoresMap = new Map();
          (latestQuiz.scores || []).forEach(s => {
            scoresMap.set(s.guestId, {
              name: s.name,
              totalPoints: s.totalPoints,
              correctAnswers: s.correctAnswers
            });
          });

          room.quizState = {
            quizId: latestQuiz._id.toString(),
            questions: latestQuiz.questions,
            activeIndex: latestQuiz.activeQuestionIndex !== undefined ? latestQuiz.activeQuestionIndex : -1,
            timer: null,
            secondsLeft: 0,
            questionStartTime: Date.now(),
            responses: responsesMap,
            scores: scoresMap
          };
          console.log(`[socket] Restored quizState for room ${code} with ${latestQuiz.questions.length} questions`);
        }

        // Restore attendee states from DB if the room in memory doesn't have them
        const attendeeDocs = await Attendee.find({ roomCode: code });
        for (const att of attendeeDocs) {
          if (!room.attendees.has(att.guestId)) {
            room.attendees.set(att.guestId, {
              socketId: att.isOnline ? att.socketId : null,
              name: att.name,
              avatarSeed: att.avatarSeed,
              status: att.understandingStatus || 'fine',
              isHandRaised: !!att.isHandRaised,
              handRaiseQuestion: att.handRaiseQuestion || '',
            });
          }
        }

        socket.join(`room:${code}`);
        socket.join(`host:${code}`);
        socket.emit('host_registered', { roomCode: code, isFrozen: room.isFrozen });
        socket.emit('roster_update', { attendees: getRosterArray(room) });
        console.log(`[socket] Host registered: room ${code}`);
      } catch (err) {
        console.error('[socket] host_room handler error:', err);
      }
    });

    // ─────────────────────────────────────────────
    // ATTENDEE: Join room
    // ─────────────────────────────────────────────
    socket.on('join_room', (payload) =>
      attendanceHandler.handleJoinRoom(io, socket, payload, rooms)
    );

    // ─────────────────────────────────────────────
    // ATTENDANCE PING
    // ─────────────────────────────────────────────
    socket.on('trigger_attendance', (payload) =>
      attendanceHandler.handleTriggerAttendance(io, socket, payload, rooms)
    );

    socket.on('mark_attendance', (payload) =>
      attendanceHandler.handleMarkAttendance(io, socket, payload, rooms)
    );

    // ─────────────────────────────────────────────
    // QUIZ / GAME LOOP
    // ─────────────────────────────────────────────
    socket.on('create_quiz', (payload) =>
      quizHandler.handleCreateQuiz(io, socket, payload, rooms)
    );

    socket.on('reset_quiz', (payload) =>
      quizHandler.handleResetQuiz(io, socket, payload, rooms)
    );

    socket.on('launch_question', (payload) =>
      quizHandler.handleLaunchQuestion(io, socket, payload, rooms)
    );

    socket.on('submit_answer', (payload) =>
      quizHandler.handleSubmitAnswer(io, socket, payload, rooms)
    );

    socket.on('host_show_scoreboard', (payload) =>
      quizHandler.handleShowScoreboard(io, socket, payload, rooms)
    );

    socket.on('host_show_podium', (payload) =>
      quizHandler.handleShowPodium(io, socket, payload, rooms)
    );

    socket.on('clear_leaderboard', (payload) =>
      quizHandler.handleClearLeaderboard(io, socket, payload, rooms)
    );

    socket.on('kick_user', async ({ roomCode, guestId }) => {
      const code = roomCode.toUpperCase();
      const room = rooms.get(code);
      if (!room || room.hostSocketId !== socket.id) return;

      const attendee = room.attendees.get(guestId);
      if (attendee) {
        if (attendee.socketId) {
          io.to(attendee.socketId).emit('kicked');
        }
        
        room.attendees.delete(guestId);

        try {
          const Attendee = require('../models/Attendee');
          await Attendee.deleteOne({ guestId, roomCode: code });
        } catch (err) {
          console.error(`[socket] Error deleting kicked attendee ${guestId} from DB:`, err.message);
        }

        io.to(`room:${code}`).emit('roster_update', {
          attendees: getRosterArray(room),
        });
        console.log(`[socket] Host kicked attendee ${guestId} from room ${code}`);
      }
    });

    socket.on('join_presentation', (payload) => {
      const { roomCode } = payload;
      const code = roomCode.toUpperCase();
      const room = rooms.get(code);
      if (!room) {
        socket.emit('join_error', { message: 'Session not found' });
        return;
      }
      
      socket.join(`room:${code}`);
      socket.join(`host:${code}`); // So it gets roster updates and leaderboards
      
      let scores = [];
      let activeIndex = -1;
      let secondsLeft = 0;
      let questions = [];
      let currentView = 'lobby';
      let correctIndex = -1;
      let optionCounts = [];
      
      if (room.quizState) {
        activeIndex = room.quizState.activeIndex;
        secondsLeft = room.quizState.secondsLeft;
        questions = room.quizState.questions;
        currentView = room.quizState.currentView || 'lobby';
        
        if (room.quizState.scores) {
          scores = quizHandler.buildLeaderboard(room.quizState.scores);
          scores.forEach((entry, i) => { entry.rank = i + 1; });
        }
        
        const lastIdx = room.quizState.lastQuestionIndex !== undefined ? room.quizState.lastQuestionIndex : -1;
        if (activeIndex === -1 && lastIdx >= 0 && questions.length > 0) {
          const lastQ = questions[lastIdx];
          if (lastQ) {
            correctIndex = lastQ.correctIndex;
            optionCounts = room.quizState.optionCounts || Array(lastQ.options.length).fill(0);
          }
        }
      }
      
      const lastIdx = room.quizState ? (room.quizState.lastQuestionIndex !== undefined ? room.quizState.lastQuestionIndex : -1) : -1;
      socket.emit('presentation_state', {
        attendees: getRosterArray(room),
        quizState: room.quizState ? {
          activeIndex,
          secondsLeft,
          questions,
          scores: scores.slice(0, 10),
          currentView,
          correctIndex,
          optionCounts,
          lastQuestionIndex: activeIndex >= 0 ? activeIndex : lastIdx
        } : null
      });
    });

    // ─────────────────────────────────────────────
    // CONFUSION METER
    // ─────────────────────────────────────────────
    socket.on('update_understanding_status', (payload) =>
      confusionHandler.handleStatusUpdate(io, socket, payload, rooms)
    );

    // ─────────────────────────────────────────────
    // HANDRAISE
    // ─────────────────────────────────────────────
    socket.on('raise_hand', (payload) =>
      handraiseHandler.handleRaiseHand(io, socket, payload, rooms)
    );

    socket.on('lower_hand', (payload) =>
      handraiseHandler.handleLowerHand(io, socket, payload, rooms)
    );

    socket.on('lower_student_hand', (payload) =>
      handraiseHandler.handleLowerStudentHand(io, socket, payload, rooms)
    );

    socket.on('lower_all_hands', (payload) =>
      handraiseHandler.handleLowerAllHands(io, socket, payload, rooms)
    );

    // ─────────────────────────────────────────────
    // BROADCASTS
    // ─────────────────────────────────────────────
    socket.on('broadcast_snippet', (payload) =>
      broadcastHandler.handleBroadcastSnippet(io, socket, payload, rooms)
    );

    socket.on('push_resource', (payload) =>
      broadcastHandler.handlePushResource(io, socket, payload, rooms)
    );

    // ─────────────────────────────────────────────
    // MASTER OVERRIDES
    // ─────────────────────────────────────────────
    socket.on('toggle_freeze', ({ roomCode }) => {
      const code = roomCode.toUpperCase();
      const room = rooms.get(code);
      if (!room || room.hostSocketId !== socket.id) return;

      room.isFrozen = !room.isFrozen;
      io.to(`room:${code}`).emit('freeze_update', { isFrozen: room.isFrozen });
      console.log(`[socket] Room ${code} freeze → ${room.isFrozen}`);
    });

    socket.on('buzz_users', ({ roomCode, guestIds, buzzAll }) => {
      const code = roomCode.toUpperCase();
      const room = rooms.get(code);
      if (!room || room.hostSocketId !== socket.id) return;

      const targets = buzzAll
        ? [...room.attendees.values()]
        : (guestIds || []).map((id) => room.attendees.get(id)).filter(Boolean);

      targets.forEach((attendee) => {
        io.to(attendee.socketId).emit('receive_buzz');
      });
      console.log(`[socket] Buzzed ${targets.length} attendees in room ${code}`);
    });

    // ─────────────────────────────────────────────
    // DISCONNECT
    // ─────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[socket] disconnect: ${socket.id}`);

      // Check if a host disconnected — mark room inactive
      for (const [code, room] of rooms.entries()) {
        if (room.hostSocketId === socket.id) {
          room.hostSocketId = null;
          console.log(`[socket] Host of room ${code} disconnected`);
          // Keep room state alive for 30s to allow reconnect
          setTimeout(() => {
            if (!rooms.get(code)?.hostSocketId) {
              if (room.confusionInterval) clearInterval(room.confusionInterval);
              rooms.delete(code);
              console.log(`[socket] Room ${code} cleaned up`);
            }
          }, 30000);
          break;
        }

        // Immediately remove attendee from roster and DB if they disconnect ("gone be gone")
        for (const [guestId, attendee] of room.attendees.entries()) {
          if (attendee.socketId === socket.id) {
            room.attendees.delete(guestId);
            
            const Attendee = require('../models/Attendee');
            Attendee.deleteOne({ guestId, roomCode: code }).catch((err) =>
              console.error(`[socket] Error deleting disconnected attendee ${guestId} from DB:`, err.message)
            );

            // Broadcast updated roster to entire room (including presentation)
            io.to(`room:${code}`).emit('roster_update', {
              attendees: getRosterArray(room),
            });
            break;
          }
        }
      }
    });
  });
}

// getRosterArray imported from socketUtils

/**
 * Closes and flushes a room's socket resources and state.
 * @param {string} code
 */
function closeRoom(code) {
  const room = rooms.get(code);
  if (!room) return;

  if (room.confusionInterval) {
    clearInterval(room.confusionInterval);
  }

  // Emit session_ended to everyone in the room
  if (ioInstance) {
    ioInstance.to(`room:${code}`).emit('session_ended');
  }

  rooms.delete(code);
  console.log(`[socket] Room ${code} closed and flushed from memory`);
}

module.exports = { initSocketController, rooms, getRosterArray, closeRoom };
