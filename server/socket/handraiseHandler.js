/**
 * @fileoverview Handraise socket event handlers.
 * Manages student hand raising, text questions, and host lower-hand overrides.
 */
const Attendee = require('../models/Attendee');
const { getRosterArray } = require('./socketUtils');

/**
 * raise_hand — Attendee raises hand with optional text question.
 */
async function handleRaiseHand(io, socket, payload, rooms) {
  const { roomCode, guestId, question = '' } = payload;
  const code = roomCode.toUpperCase();
  const room = rooms.get(code);
  if (!room) return;

  const attendee = room.attendees.get(guestId);
  if (!attendee) return;

  // Update in-memory state
  attendee.isHandRaised = true;
  attendee.handRaiseQuestion = question.trim();

  // Update DB (optional but good for persistence on refresh)
  try {
    await Attendee.updateOne(
      { guestId, roomCode: code },
      { isHandRaised: true, handRaiseQuestion: question.trim() }
    );
  } catch (err) {
    console.error('[handraise] DB update error:', err.message);
  }

  // Acknowledge to the student
  socket.emit('hand_state_changed', {
    isHandRaised: true,
    handRaiseQuestion: attendee.handRaiseQuestion,
  });

  // Notify host via roster update
  io.to(`host:${code}`).emit('roster_update', {
    attendees: getRosterArray(room),
  });

  // Emit a specific notification to host
  io.to(`host:${code}`).emit('hand_raised_notification', {
    name: attendee.name,
    question: attendee.handRaiseQuestion,
  });

  console.log(`[handraise] Student ${attendee.name} raised hand in room ${code}`);
}

/**
 * lower_hand — Attendee lowers their own hand.
 */
async function handleLowerHand(io, socket, payload, rooms) {
  const { roomCode, guestId } = payload;
  const code = roomCode.toUpperCase();
  const room = rooms.get(code);
  if (!room) return;

  const attendee = room.attendees.get(guestId);
  if (!attendee) return;

  // Update in-memory state
  attendee.isHandRaised = false;
  attendee.handRaiseQuestion = '';

  // Update DB
  try {
    await Attendee.updateOne(
      { guestId, roomCode: code },
      { isHandRaised: false, handRaiseQuestion: '' }
    );
  } catch (err) {
    console.error('[handraise] DB update error:', err.message);
  }

  // Acknowledge to the student
  socket.emit('hand_state_changed', {
    isHandRaised: false,
    handRaiseQuestion: '',
  });

  // Notify host via roster update
  io.to(`host:${code}`).emit('roster_update', {
    attendees: getRosterArray(room),
  });

  console.log(`[handraise] Student ${attendee.name} lowered hand in room ${code}`);
}

/**
 * lower_student_hand — Host lowers a specific student's hand.
 */
async function handleLowerStudentHand(io, socket, payload, rooms) {
  const { roomCode, guestId } = payload;
  const code = roomCode.toUpperCase();
  const room = rooms.get(code);
  
  if (!room) {
    console.error(`[handraise] lower student hand failed: Room ${code} not found in memory`);
    return;
  }
  if (room.hostSocketId !== socket.id) {
    console.error(`[handraise] lower student hand failed: socket.id (${socket.id}) does not match hostSocketId (${room.hostSocketId})`);
    return;
  }

  const attendee = room.attendees.get(guestId);
  if (!attendee) {
    console.error(`[handraise] lower student hand failed: Attendee ${guestId} not found in room ${code}`);
    return;
  }

  attendee.isHandRaised = false;
  attendee.handRaiseQuestion = '';

  try {
    await Attendee.updateOne(
      { guestId, roomCode: code },
      { isHandRaised: false, handRaiseQuestion: '' }
    );
  } catch (err) {
    console.error('[handraise] DB update error:', err.message);
  }

  // Notify the student's socket specifically
  if (attendee.socketId) {
    io.to(attendee.socketId).emit('hand_state_changed', {
      isHandRaised: false,
      handRaiseQuestion: '',
    });
  }

  // Notify host via roster update
  io.to(`host:${code}`).emit('roster_update', {
    attendees: getRosterArray(room),
  });

  console.log(`[handraise] Host lowered hand of ${attendee.name} in room ${code}`);
}

/**
 * lower_all_hands — Host lowers all students' hands.
 */
async function handleLowerAllHands(io, socket, payload, rooms) {
  const { roomCode } = payload;
  const code = roomCode.toUpperCase();
  const room = rooms.get(code);

  if (!room) {
    console.error(`[handraise] lower all hands failed: Room ${code} not found in memory`);
    return;
  }
  if (room.hostSocketId !== socket.id) {
    console.error(`[handraise] lower all hands failed: socket.id (${socket.id}) does not match hostSocketId (${room.hostSocketId})`);
    return;
  }

  // Reset all in memory and notify sockets
  for (const [guestId, attendee] of room.attendees.entries()) {
    if (attendee.isHandRaised) {
      attendee.isHandRaised = false;
      attendee.handRaiseQuestion = '';

      if (attendee.socketId) {
        io.to(attendee.socketId).emit('hand_state_changed', {
          isHandRaised: false,
          handRaiseQuestion: '',
        });
      }
    }
  }

  // Reset all in DB
  try {
    await Attendee.updateMany(
      { roomCode: code },
      { isHandRaised: false, handRaiseQuestion: '' }
    );
  } catch (err) {
    console.error('[handraise] DB update error:', err.message);
  }

  // Notify host via roster update
  io.to(`host:${code}`).emit('roster_update', {
    attendees: getRosterArray(room),
  });

  console.log(`[handraise] Host lowered all hands in room ${code}`);
}

module.exports = {
  handleRaiseHand,
  handleLowerHand,
  handleLowerStudentHand,
  handleLowerAllHands,
};
