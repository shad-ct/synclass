/**
 * @fileoverview useSocket — Custom hook for subscribing to Socket.io events.
 * Automatically removes listeners on unmount to prevent memory leaks.
 *
 * @example
 * useSocket('roster_update', ({ attendees }) => setAttendees(attendees));
 */
import { useEffect } from 'react';
import { socket } from '../socket';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SocketCallback = (...args: any[]) => void;

/**
 * Subscribes to a socket event for the lifetime of the component.
 * @param event - The socket event name to listen to.
 * @param callback - Handler function for the event payload.
 */
export function useSocket(event: string, callback: SocketCallback): void {
  useEffect(() => {
    socket.on(event, callback);
    return () => {
      socket.off(event, callback);
    };
  }, [event, callback]);
}

export default useSocket;
