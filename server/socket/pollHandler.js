/**
 * @fileoverview Live poll socket handlers.
 * Hosts can start one active poll at a time; attendees can vote once.
 */
const mongoose = require('mongoose');
const Session = require('../models/Session');

function buildOptionCounts(options, responsesMap) {
  const counts = Array(options.length).fill(0);
  for (const response of responsesMap.values()) {
    if (response.optionIndex >= 0 && response.optionIndex < counts.length) {
      counts[response.optionIndex] += 1;
    }
  }
  return counts;
}

function buildPollPayload(pollState) {
  if (!pollState) return null;

  return {
    id: pollState.id,
    question: pollState.question,
    options: pollState.options,
    isActive: pollState.isActive,
    createdAt: pollState.createdAt,
    closedAt: pollState.closedAt || null,
    responseCount: pollState.responses.size,
    optionCounts: buildOptionCounts(pollState.options, pollState.responses),
  };
}

function buildPollStateFromDoc(pollDoc) {
  const responses = new Map();
  for (const response of pollDoc.responses || []) {
    responses.set(response.guestId, {
      guestId: response.guestId,
      name: response.name || '',
      optionIndex: response.optionIndex,
      answeredAt: response.answeredAt ? response.answeredAt.toISOString() : new Date().toISOString(),
    });
  }

  return {
    id: pollDoc._id.toString(),
    question: pollDoc.question,
    options: pollDoc.options || [],
    isActive: !!pollDoc.isActive,
    createdAt: pollDoc.createdAt ? pollDoc.createdAt.toISOString() : new Date().toISOString(),
    closedAt: pollDoc.closedAt ? pollDoc.closedAt.toISOString() : null,
    responses,
  };
}

function emitPollError(socket, message) {
  socket.emit('poll_error', { message });
}

async function handleCreatePoll(io, socket, payload, rooms) {
  const { roomCode, question, options } = payload;
  const code = roomCode.toUpperCase();
  const room = rooms.get(code);
  if (!room || room.hostSocketId !== socket.id) return;

  const cleanQuestion = typeof question === 'string' ? question.trim() : '';
  const cleanOptions = Array.isArray(options)
    ? options.map((option) => String(option || '').trim()).filter(Boolean)
    : [];

  if (!cleanQuestion) {
    emitPollError(socket, 'Poll question is required.');
    return;
  }

  if (cleanOptions.length < 2) {
    emitPollError(socket, 'Poll must have at least two options.');
    return;
  }

  if (cleanOptions.length > 6) {
    emitPollError(socket, 'Poll can have up to six options.');
    return;
  }

  try {
    const session = await Session.findOne({ roomCode: code });
    if (!session) {
      emitPollError(socket, 'Session not found.');
      return;
    }

    const now = new Date();
    for (const poll of session.polls || []) {
      if (poll.isActive) {
        poll.isActive = false;
        poll.closedAt = now;
      }
    }

    const pollId = new mongoose.Types.ObjectId();
    const pollDoc = {
      _id: pollId,
      question: cleanQuestion,
      options: cleanOptions,
      isActive: true,
      createdAt: now,
      closedAt: null,
      responses: [],
    };

    session.polls.push(pollDoc);
    await session.save();

    room.pollState = {
      id: pollId.toString(),
      question: cleanQuestion,
      options: cleanOptions,
      isActive: true,
      createdAt: now.toISOString(),
      closedAt: null,
      responses: new Map(),
    };

    const poll = buildPollPayload(room.pollState);
    socket.emit('poll_created', { poll });
    io.to(`room:${code}`).except(`host:${code}`).emit('poll_started', poll);

    console.log(`[poll] Poll created in room ${code}: "${cleanQuestion}"`);
  } catch (err) {
    console.error('[poll] handleCreatePoll error:', err.message);
    emitPollError(socket, 'Failed to create poll.');
  }
}

async function handleSubmitPollVote(io, socket, payload, rooms) {
  const { roomCode, pollId, guestId, name, optionIndex } = payload;
  const code = roomCode.toUpperCase();
  const room = rooms.get(code);
  if (!room || !room.pollState || !room.pollState.isActive) return;

  const pollState = room.pollState;
  if (pollState.id !== pollId) return;

  const selectedIndex = Number(optionIndex);
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= pollState.options.length) {
    return;
  }

  const existingResponse = pollState.responses.get(guestId);
  if (existingResponse) {
    socket.emit('poll_vote_recorded', {
      selectedOption: existingResponse.optionIndex,
      poll: {
        ...buildPollPayload(pollState),
        hasResponded: true,
        selectedOption: existingResponse.optionIndex,
      },
    });
    return;
  }

  const response = {
    guestId,
    name: name || '',
    optionIndex: selectedIndex,
    answeredAt: new Date().toISOString(),
  };

  pollState.responses.set(guestId, response);

  try {
    const session = await Session.findOne({ roomCode: code });
    const pollDoc = session?.polls?.id(pollState.id);
    if (pollDoc && pollDoc.isActive) {
      const alreadySaved = pollDoc.responses.some((saved) => saved.guestId === guestId);
      if (!alreadySaved) {
        pollDoc.responses.push({
          guestId,
          name: name || '',
          optionIndex: selectedIndex,
          answeredAt: new Date(),
        });
        await session.save();
      }
    }
  } catch (err) {
    console.error('[poll] handleSubmitPollVote DB error:', err.message);
  }

  const poll = buildPollPayload(pollState);
  socket.emit('poll_vote_recorded', {
    selectedOption: selectedIndex,
    poll: {
      ...poll,
      hasResponded: true,
      selectedOption: selectedIndex,
    },
  });
  io.to(`host:${code}`).emit('poll_results_update', { poll });
  io.to(`room:${code}`).except(`host:${code}`).emit('poll_results_update', { poll });

  console.log(`[poll] ${name || guestId} voted in room ${code}`);
}

async function handleClosePoll(io, socket, payload, rooms) {
  const { roomCode, pollId } = payload;
  const code = roomCode.toUpperCase();
  const room = rooms.get(code);
  if (!room || room.hostSocketId !== socket.id || !room.pollState) return;

  if (pollId && room.pollState.id !== pollId) return;

  const closedAt = new Date();
  room.pollState.isActive = false;
  room.pollState.closedAt = closedAt.toISOString();

  try {
    const session = await Session.findOne({ roomCode: code });
    const pollDoc = session?.polls?.id(room.pollState.id);
    if (pollDoc) {
      pollDoc.isActive = false;
      pollDoc.closedAt = closedAt;
      await session.save();
    }
  } catch (err) {
    console.error('[poll] handleClosePoll DB error:', err.message);
  }

  const poll = buildPollPayload(room.pollState);
  io.to(`room:${code}`).emit('poll_closed', { poll });
  console.log(`[poll] Poll closed in room ${code}`);
}

module.exports = {
  handleCreatePoll,
  handleSubmitPollVote,
  handleClosePoll,
  buildPollPayload,
  buildPollStateFromDoc,
};
