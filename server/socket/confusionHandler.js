/**
 * @fileoverview Confusion Meter socket handler.
 *
 * Architecture:
 * - Attendees emit `update_understanding_status` when they toggle Lost/Fine.
 * - Server updates the in-memory attendee's status field immediately.
 * - A 500ms interval aggregates ALL attendee statuses and emits `confusion_update`
 *   to the host — this is the "streaming" behavior.
 */

/**
 * Starts the 500ms confusion aggregation interval for a room.
 * Should be called once per room when the host registers.
 * @param {import('socket.io').Server} io
 * @param {string} code - roomCode (uppercase)
 * @param {Map} rooms
 */
function startConfusionBroadcast(io, code, rooms) {
  const room = rooms.get(code);
  if (!room) return;

  // Clear any existing interval
  if (room.confusionInterval) clearInterval(room.confusionInterval);

  room.confusionInterval = setInterval(() => {
    const currentRoom = rooms.get(code);
    if (!currentRoom || !currentRoom.hostSocketId) return;

    const attendees = [...currentRoom.attendees.values()];
    const total = attendees.filter((a) => a.socketId).length; // only online
    const lostCount = attendees.filter((a) => a.socketId && a.status === 'lost').length;
    const percentage = total > 0 ? Math.round((lostCount / total) * 100) : 0;

    io.to(`host:${code}`).emit('confusion_update', {
      lostCount,
      total,
      percentage,
      timestamp: Date.now(),
    });
  }, 500);

  console.log(`[confusion] Started confusion broadcast for room ${code}`);
}

/**
 * update_understanding_status — Attendee toggles Lost/Fine.
 * @param {{ roomCode: string, guestId: string, status: 'fine'|'lost' }} payload
 */
function handleStatusUpdate(io, socket, payload, rooms) {
  const { roomCode, guestId, status } = payload;
  const code = roomCode.toUpperCase();
  const room = rooms.get(code);
  if (!room) return;

  const attendee = room.attendees.get(guestId);
  if (!attendee) return;

  attendee.status = status === 'lost' ? 'lost' : 'fine';

  // Immediate ack to the attendee
  socket.emit('status_updated', { status: attendee.status });
}

module.exports = { startConfusionBroadcast, handleStatusUpdate };
