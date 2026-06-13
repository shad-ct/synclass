/**
 * @fileoverview Attendance socket event handlers.
 * Manages join_room, trigger_attendance, and mark_attendance events.
 */
const Session = require('../models/Session');
const Attendee = require('../models/Attendee');
const { getRosterArray } = require('./socketUtils');
const { buildPollPayload } = require('./pollHandler');

/**
 * join_room — Attendee connects to a room.
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @param {{ roomCode: string, guestId: string, name: string, avatarSeed: string }} payload
 * @param {Map} rooms
 */
async function handleJoinRoom(io, socket, payload, rooms) {
  try {
    const { roomCode, guestId, name, avatarSeed } = payload;
    const code = roomCode.toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      socket.emit('join_error', { message: 'Room not found or host has left.' });
      return;
    }

    // Join the socket room
    socket.join(`room:${code}`);

    // Upsert attendee in in-memory map preserving handraise state
    const existingMemory = room.attendees.get(guestId);
    let isHandRaised = existingMemory ? !!existingMemory.isHandRaised : false;
    let handRaiseQuestion = existingMemory ? existingMemory.handRaiseQuestion || '' : '';

    if (!existingMemory) {
      const dbAttendee = await Attendee.findOne({ guestId, roomCode: code });
      if (dbAttendee) {
        isHandRaised = !!dbAttendee.isHandRaised;
        handRaiseQuestion = dbAttendee.handRaiseQuestion || '';
      }
    }

    room.attendees.set(guestId, {
      socketId: socket.id,
      name,
      avatarSeed: avatarSeed || name,
      status: existingMemory?.status || 'fine',
      isHandRaised,
      handRaiseQuestion,
    });

    // Upsert attendee in MongoDB
    const attendeeDoc = await Attendee.findOneAndUpdate(
      { guestId },
      {
        guestId,
        name,
        avatarSeed: avatarSeed || name,
        roomCode: code,
        isOnline: true,
        socketId: socket.id,
      },
      { upsert: true, new: true }
    );

    // Add to session's attendees array if not already present
    await Session.updateOne(
      { roomCode: code },
      { $addToSet: { attendees: attendeeDoc._id } }
    );

    // Confirm join to the attendee — send current room state
    socket.emit('join_confirmed', {
      roomCode: code,
      guestId,
      isFrozen: room.isFrozen,
      quizActive: room.quizState?.activeIndex >= 0,
      isHandRaised,
      handRaiseQuestion,
    });

    // Broadcast updated roster to host
    io.to(`host:${code}`).emit('roster_update', {
      attendees: getRosterArray(room),
    });

    if (room.pollState && room.pollState.isActive) {
      const response = room.pollState.responses.get(guestId);
      socket.emit('poll_started', {
        ...buildPollPayload(room.pollState),
        hasResponded: !!response,
        selectedOption: response ? response.optionIndex : null,
      });
    }

    // If a quiz is active, immediately sync the newly joined/reconnected attendee with the current view
    if (room.quizState) {
      const qs = room.quizState;
      if (qs.currentView === 'question' && qs.activeIndex >= 0) {
        const question = qs.questions[qs.activeIndex];
        if (question) {
          socket.emit('question_start', {
            questionIndex: qs.activeIndex,
            text: question.text,
            options: question.options,
            timeLimit: question.timeLimit || 20,
            secondsLeft: qs.secondsLeft,
          });

          // Check if this attendee already responded
          const response = qs.responses.get(guestId);
          if (response) {
            socket.emit('answer_received', {
              hasAnswered: true,
            });
          }
        }
      } else if (qs.currentView === 'results' && qs.lastQuestionIndex >= 0) {
        const question = qs.questions[qs.lastQuestionIndex];
        const resp = qs.responses.get(guestId);
        const existing = qs.scores.get(guestId);
        
        // Build leaderboard locally
        const leaderboard = [...qs.scores.entries()]
          .map(([gid, d]) => ({ guestId: gid, ...d }))
          .sort((a, b) => b.totalPoints - a.totalPoints);
        
        let currentRank = 1;
        for (let i = 0; i < leaderboard.length; i++) {
          if (i > 0 && leaderboard[i].totalPoints < leaderboard[i - 1].totalPoints) {
            currentRank = i + 1;
          }
          leaderboard[i].rank = currentRank;
        }

        const rank = leaderboard.findIndex((entry) => entry.guestId === guestId) + 1;

        if (question) {
          socket.emit('question_end', {
            questionIndex: qs.lastQuestionIndex,
            correctIndex: question.correctIndex,
            leaderboard: leaderboard.slice(0, 10),
            optionCounts: qs.optionCounts || [],
          });
          socket.emit('answer_received', {
            isCorrect: resp ? resp.isCorrect : false,
            pointsAwarded: resp ? resp.pointsAwarded : 0,
            correctIndex: question.correctIndex,
            currentTotal: existing ? existing.totalPoints : 0,
            rank: rank || 0,
            totalPlayers: leaderboard.length,
          });
        }
      } else if (qs.currentView === 'scoreboard') {
        const leaderboard = [...qs.scores.entries()]
          .map(([gid, d]) => ({ guestId: gid, ...d }))
          .sort((a, b) => b.totalPoints - a.totalPoints);
        
        let currentRank = 1;
        for (let i = 0; i < leaderboard.length; i++) {
          if (i > 0 && leaderboard[i].totalPoints < leaderboard[i - 1].totalPoints) {
            currentRank = i + 1;
          }
          leaderboard[i].rank = currentRank;
        }

        socket.emit('show_scoreboard', {
          leaderboard: leaderboard.slice(0, 10),
        });
      } else if (qs.currentView === 'podium') {
        const leaderboard = [...qs.scores.entries()]
          .map(([gid, d]) => ({ guestId: gid, ...d }))
          .sort((a, b) => b.totalPoints - a.totalPoints);
        
        let currentRank = 1;
        for (let i = 0; i < leaderboard.length; i++) {
          if (i > 0 && leaderboard[i].totalPoints < leaderboard[i - 1].totalPoints) {
            currentRank = i + 1;
          }
          leaderboard[i].rank = currentRank;
        }

        socket.emit('show_podium', {
          leaderboard: leaderboard.slice(0, 3),
        });
      }
    }

    console.log(`[attendance] ${name} (${guestId}) joined room ${code}`);
  } catch (err) {
    console.error('[attendance] handleJoinRoom error:', err.message);
    socket.emit('join_error', { message: 'Failed to join room.' });
  }
}

/**
 * trigger_attendance — Host pings all attendees to acknowledge presence.
 * @param {{ roomCode: string }} payload
 */
async function handleTriggerAttendance(io, socket, payload, rooms) {
  const { roomCode } = payload;
  const code = roomCode.toUpperCase();
  const room = rooms.get(code);
  if (!room || room.hostSocketId !== socket.id) return;

  const triggeredAt = new Date();

  try {
    // Add a new attendance log to MongoDB
    const result = await Session.findOneAndUpdate(
      { roomCode: code },
      { $push: { attendanceLogs: { triggeredAt, acknowledgedBy: [] } } },
      { new: true }
    );

    if (!result || !result.attendanceLogs || result.attendanceLogs.length === 0) {
      console.error(`[attendance] Failed to create attendance log in DB for room ${code}`);
      return;
    }

    const logId = result.attendanceLogs[result.attendanceLogs.length - 1]._id;

    // Broadcast attendance modal to all room members
    io.to(`room:${code}`).emit('attendance_ping', {
      logId: logId.toString(),
      triggeredAt,
      timeoutMs: 15000, // 15 seconds to respond
    });

    // Auto-close after timeout
    setTimeout(() => {
      io.to(`room:${code}`).emit('attendance_closed', { logId: logId.toString() });
      io.to(`host:${code}`).emit('attendance_summary_ready', { logId: logId.toString() });
    }, 15000);

    console.log(`[attendance] Attendance triggered in room ${code}, logId: ${logId}`);
  } catch (err) {
    console.error('[attendance] handleTriggerAttendance DB error:', err.message);
  }
}

/**
 * mark_attendance — Attendee acknowledges the attendance ping.
 * @param {{ roomCode: string, guestId: string, name: string, logId: string }} payload
 */
async function handleMarkAttendance(io, socket, payload, rooms) {
  const { roomCode, guestId, name, logId } = payload;
  const code = roomCode.toUpperCase();

  try {
    const attendeeDoc = await Attendee.findOne({ guestId });

    await Session.updateOne(
      { roomCode: code, 'attendanceLogs._id': logId },
      {
        $addToSet: {
          'attendanceLogs.$.acknowledgedBy': {
            attendeeId: attendeeDoc?._id,
            guestId,
            name,
            timestamp: new Date(),
          },
        },
      }
    );

    // Confirm to the individual attendee
    socket.emit('attendance_marked', { logId });

    // Notify host of new acknowledgement
    io.to(`host:${code}`).emit('attendance_acknowledged', { guestId, name, logId });
    console.log(`[attendance] ${name} marked attendance for log ${logId}`);
  } catch (err) {
    console.error('[attendance] handleMarkAttendance error:', err.message);
  }
}

module.exports = { handleJoinRoom, handleTriggerAttendance, handleMarkAttendance };
