/**
 * @fileoverview Shared socket utility functions.
 */

/**
 * Converts the attendees Map to a plain array for client consumption.
 * @param {object} room
 * @returns {Array}
 */
function getRosterArray(room) {
  return [...room.attendees.entries()].map(([guestId, a]) => ({
    guestId,
    name: a.name,
    avatarSeed: a.avatarSeed,
    status: a.status,
    isOnline: !!a.socketId,
    isHandRaised: !!a.isHandRaised,
    handRaiseQuestion: a.handRaiseQuestion || '',
  }));
}

module.exports = {
  getRosterArray,
};
