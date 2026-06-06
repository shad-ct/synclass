/**
 * @fileoverview Broadcast socket handlers.
 * Handles text/code snippet broadcasts and resource push events.
 */
const Session = require('../models/Session');
const Resource = require('../models/Resource');

/**
 * broadcast_snippet — Host sends a text or code snippet to all attendees.
 * Persists to MongoDB Session.broadcasts array.
 * @param {{ roomCode: string, content: string, contentType: 'text'|'code' }} payload
 */
async function handleBroadcastSnippet(io, socket, payload, rooms) {
  const { roomCode, content, contentType = 'code' } = payload;
  const code = roomCode.toUpperCase();
  const room = rooms.get(code);
  if (!room || room.hostSocketId !== socket.id) return;

  if (!content || !content.trim()) return;

  // Persist to DB
  try {
    await Session.updateOne(
      { roomCode: code },
      {
        $push: {
          broadcasts: {
            content: content.trim(),
            type: contentType,
            sentAt: new Date(),
          },
        },
      }
    );
  } catch (err) {
    console.error('[broadcast] handleBroadcastSnippet DB error:', err.message);
  }

  // Broadcast to all attendees in the room (except host socket room)
  io.to(`room:${code}`).except(`host:${code}`).emit('receive_snippet', {
    content: content.trim(),
    contentType,
    sentAt: new Date().toISOString(),
  });

  // Also emit back to host to confirm
  socket.emit('snippet_sent', { content: content.trim(), contentType });

  console.log(`[broadcast] Snippet broadcast in room ${code} (${contentType})`);
}

/**
 * push_resource — Host pushes a previously uploaded resource to attendees.
 * @param {{ roomCode: string, resourceId: string }} payload
 */
async function handlePushResource(io, socket, payload, rooms) {
  const { roomCode, resourceId } = payload;
  const code = roomCode.toUpperCase();
  const room = rooms.get(code);
  if (!room || room.hostSocketId !== socket.id) return;

  try {
    const resource = await Resource.findById(resourceId, { serverPath: 0 });
    if (!resource) {
      socket.emit('push_error', { message: 'Resource not found' });
      return;
    }

    io.to(`room:${code}`).except(`host:${code}`).emit('receive_resource', {
      id: resource._id,
      originalName: resource.originalName,
      mimeType: resource.mimeType,
      publicUrl: resource.publicUrl,
      description: resource.description,
      sizeBytes: resource.sizeBytes,
    });

    socket.emit('resource_pushed', { resourceId });
    console.log(`[broadcast] Resource "${resource.originalName}" pushed in room ${code}`);
  } catch (err) {
    console.error('[broadcast] handlePushResource error:', err.message);
    socket.emit('push_error', { message: 'Failed to push resource' });
  }
}

module.exports = { handleBroadcastSnippet, handlePushResource };
