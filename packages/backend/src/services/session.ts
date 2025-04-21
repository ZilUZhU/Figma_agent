import { randomUUID } from "crypto";
import {
  HistoryMessage,
  BackendChatMessage,
  FunctionCallOutputMessage,
} from "../types";
import { logger } from "../utils/logger";

export { HistoryMessage, FunctionCallOutputMessage };

export interface SessionData {
  previousResponseId: string | null;
  chatHistory: HistoryMessage[];
  lastAccessed: number;
}

const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

const sessions: Map<string, SessionData> = new Map();

function setupSessionCleanup() {
  setInterval(() => {
    const now = Date.now();
    let expiredCount = 0;
    const initialSize = sessions.size;
    sessions.forEach((session, sessionId) => {
      if (now - session.lastAccessed > SESSION_TTL) {
        sessions.delete(sessionId);
        expiredCount++;
      }
    });
    if (expiredCount > 0) {
      // INFO: Log when sessions are actually cleaned up
      logger.info(
        { expiredCount, remainingSessions: sessions.size, initialSize },
        "[Session] Cleanup task finished"
      );
    } else if (initialSize > 0) {
      // DEBUG: Log routine check when no sessions expired
      logger.debug(
        { activeSessions: initialSize },
        "[Session] Cleanup task ran, no sessions expired"
      );
    }
  }, CLEANUP_INTERVAL);
  // INFO: Log when the cleanup task starts
  logger.info(
    { intervalMs: CLEANUP_INTERVAL, ttlMs: SESSION_TTL },
    "[Session] Cleanup task started"
  );
}

// Start the cleanup task when the module loads
setupSessionCleanup();

/**
 * Retrieves session data or creates a new session if it doesn't exist or is invalid.
 * Updates the last accessed time for existing valid sessions.
 */
export function getOrCreateSession(requestedSessionId?: string): {
  sessionId: string;
  sessionData: SessionData;
  isNewSession: boolean;
} {
  let sessionId = requestedSessionId;
  let isNewSession = false;
  let sessionData: SessionData | undefined = undefined;

  if (sessionId) {
    sessionData = sessions.get(sessionId);
    if (sessionData) {
      // Check TTL
      if (Date.now() - sessionData.lastAccessed > SESSION_TTL) {
        // INFO: Log session expiration
        logger.info(
          { sessionId },
          "[Session] Session expired, creating new one"
        );
        sessions.delete(sessionId); // Remove expired session
        sessionData = undefined; // Force creation of a new session
        sessionId = undefined; // Clear the requested ID as it's invalid now
      } else {
        // Valid session, update last accessed time
        sessionData.lastAccessed = Date.now();
        // DEBUG: Log routine validation
        logger.debug({ sessionId }, "[Session] Existing session validated");
      }
    } else {
      // INFO: Log when a requested ID wasn't found
      logger.info(
        { requestedSessionId },
        "[Session] Requested session ID not found, creating new one"
      );
      sessionId = undefined; // Force creation of a new session
    }
  }

  // Create a new session if needed
  if (!sessionData) {
    sessionId = randomUUID(); // Generate a new UUID for the session
    sessionData = {
      previousResponseId: null,
      chatHistory: [], // Initialize with empty history
      lastAccessed: Date.now(),
    };
    sessions.set(sessionId, sessionData);
    isNewSession = true;
    // INFO: Log new session creation
    logger.info({ sessionId }, "[Session] New session created");
  }

  // We know sessionData is defined here, and sessionId is the correct (potentially new) ID
  return { sessionId: sessionId!, sessionData, isNewSession };
}

/**
 * Checks if a session ID exists and is within its TTL.
 * Does NOT update the last accessed time. Use getOrCreateSession for active use.
 */
export function isValidSession(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) {
    return false; // Session does not exist
  }
  // Check if expired
  if (Date.now() - session.lastAccessed > SESSION_TTL) {
    // DEBUG: Log expiration check result
    logger.debug(
      { sessionId },
      "[Session] isValidSession check: Session found but expired"
    );
    return false;
  }
  return true; // Session exists and is not expired
}

/**
 * Updates the session data with the latest response ID and chat history message.
 * Also updates the last accessed timestamp.
 */
export function updateSessionData(
  sessionId: string,
  newPreviousResponseId: string,
  messageToAdd: BackendChatMessage | FunctionCallOutputMessage
): void {
  const sessionData = sessions.get(sessionId);
  if (sessionData) {
    sessionData.previousResponseId = newPreviousResponseId;
    sessionData.chatHistory.push(messageToAdd as HistoryMessage); // Cast is safe due to union type
    sessionData.lastAccessed = Date.now(); // Update timestamp
    // TRACE: Log routine session updates at trace level
    logger.trace(
      { sessionId, historyLength: sessionData.chatHistory.length },
      "[Session] Session data updated"
    );
  } else {
    // WARN: Attempting to update non-existent session is a potential issue
    logger.warn(
      { sessionId },
      "[Session] Attempted to update non-existent session"
    );
  }
}

/**
 * Adds a message to the session's history without updating the response ID.
 * Useful for adding user messages or function results before the AI call.
 * Updates the last accessed timestamp.
 */
export function addMessageToHistory(
  sessionId: string,
  messageToAdd: BackendChatMessage | FunctionCallOutputMessage
): void {
  const sessionData = sessions.get(sessionId);
  if (sessionData) {
    sessionData.chatHistory.push(messageToAdd as HistoryMessage); // Cast is safe
    sessionData.lastAccessed = Date.now();
    // TRACE: Log routine history additions at trace level
    logger.trace(
      { sessionId, historyLength: sessionData.chatHistory.length },
      "[Session] Message added to history"
    );
  } else {
    // WARN: Attempting to add to non-existent session is a potential issue
    logger.warn(
      { sessionId },
      "[Session] Attempted to add message to non-existent session"
    );
  }
}

/**
 * Gets the current count of active (non-expired) sessions.
 */
export function getActiveSessionCount(): number {
  // Filter out potentially expired sessions just in case cleanup hasn't run
  const now = Date.now();
  let activeCount = 0;
  sessions.forEach((session) => {
    if (now - session.lastAccessed <= SESSION_TTL) {
      activeCount++;
    }
  });
  return activeCount;
}
