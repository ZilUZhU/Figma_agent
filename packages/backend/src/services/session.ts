import { randomUUID } from "crypto";
import { InputMessage, BackendChatMessage, HistoryMessage } from "../types"; // Make sure to import the correct types
import { logger } from "../utils/logger"; // Import logger

// Define the structure for function call results within the history
// (Matches the structure needed for Responses API input)
export type FunctionCallOutputMessage = {
  type: "function_call_output";
  call_id: string;
  output: string; // Must be a string
};

// Re-export HistoryMessage type for convenience
export { HistoryMessage };

// Session Data Interface
export interface SessionData {
  previousResponseId: string | null; // Renamed from lastResponseId
  chatHistory: HistoryMessage[]; // Stores the conceptual history
  lastAccessed: number; // Timestamp for TTL calculation
}

// Session Time-To-Live (TTL) in milliseconds (e.g., 24 hours)
const SESSION_TTL = 24 * 60 * 60 * 1000;

// Interval for cleaning up expired sessions (e.g., 1 hour)
const CLEANUP_INTERVAL = 60 * 60 * 1000;

// In-memory session storage (Replace with Redis/DB for production)
const sessions: Map<string, SessionData> = new Map();

// --- Session Cleanup Task ---
function setupSessionCleanup() {
  setInterval(() => {
    const now = Date.now();
    let expiredCount = 0;
    const currentSize = sessions.size;

    sessions.forEach((session, sessionId) => {
      if (now - session.lastAccessed > SESSION_TTL) {
        sessions.delete(sessionId);
        expiredCount++;
      }
    });

    if (expiredCount > 0) {
      logger.info( { expiredCount, remainingSessions: sessions.size, initialSize: currentSize }, "Session cleanup task finished" );
    } else if (currentSize > 0) {
        logger.debug({ activeSessions: currentSize }, "Session cleanup task ran, no sessions expired");
    }
  }, CLEANUP_INTERVAL);

  logger.info({ intervalMs: CLEANUP_INTERVAL, ttlMs: SESSION_TTL }, "Session cleanup task started");
}

// Start the cleanup task when the module loads
setupSessionCleanup();

/**
 * Retrieves session data or creates a new session if it doesn't exist or is invalid.
 * Updates the last accessed time for existing valid sessions.
 * @param requestedSessionId Optional ID provided by the client.
 * @returns An object containing the session ID, session data, and a flag indicating if it's a new session.
 */
export function getOrCreateSession(requestedSessionId?: string): {
  sessionId: string;
  sessionData: SessionData;
  isNewSession: boolean;
} {
  let sessionId = requestedSessionId;
  let isNewSession = false;
  let sessionData: SessionData | undefined = undefined;

  // Validate existing session ID if provided
  if (sessionId) {
    sessionData = sessions.get(sessionId);
    if (sessionData) {
      // Check TTL
      if (Date.now() - sessionData.lastAccessed > SESSION_TTL) {
        logger.info({ sessionId }, "Session expired, creating new one");
        sessions.delete(sessionId); // Remove expired session
        sessionData = undefined; // Force creation of a new session
        sessionId = undefined; // Clear the requested ID as it's invalid now
      } else {
        // Valid session, update last accessed time
        sessionData.lastAccessed = Date.now();
        logger.debug({ sessionId }, "Existing session found and validated");
      }
    } else {
      logger.info({ requestedSessionId }, "Requested session ID not found, creating new one");
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
    logger.info({ sessionId }, "New session created");
  }

  // We know sessionData is defined here, and sessionId is the correct (potentially new) ID
  return { sessionId: sessionId!, sessionData, isNewSession };
}

/**
 * Checks if a session ID exists and is within its TTL.
 * Does NOT update the last accessed time. Use getOrCreateSession for active use.
 * @param sessionId The session ID to validate.
 * @returns True if the session exists and is not expired, false otherwise.
 */
export function isValidSession(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) {
    return false; // Session does not exist
  }
  // Check if expired
  if (Date.now() - session.lastAccessed > SESSION_TTL) {
     // Optionally log or delete here, but getOrCreateSession handles deletion too
     logger.debug({sessionId}, "isValidSession check: Session found but expired");
    return false;
  }
  return true; // Session exists and is not expired
}

/**
 * Updates the session data with the latest response ID and chat history.
 * Also updates the last accessed timestamp.
 * @param sessionId The ID of the session to update.
 * @param newPreviousResponseId The ID of the *latest* OpenAI response (to be used as previousResponseId in the *next* call).
 * @param messageToAdd The message (user, assistant, or function output) to add to the history.
 */
export function updateSessionData(
  sessionId: string,
  newPreviousResponseId: string,
  messageToAdd: BackendChatMessage | FunctionCallOutputMessage
): void {
  const sessionData = sessions.get(sessionId);
  if (sessionData) {
    sessionData.previousResponseId = newPreviousResponseId;
    // Append the new message to the conceptual history
    sessionData.chatHistory.push(messageToAdd as HistoryMessage);
    sessionData.lastAccessed = Date.now(); // Update timestamp
    logger.debug({ sessionId, newPreviousResponseId, historyLength: sessionData.chatHistory.length }, "Session data updated");
  } else {
     logger.warn({ sessionId }, "Attempted to update non-existent session");
  }
}


/**
 * Adds a message to the session's history without updating the response ID.
 * Useful for adding user messages or function results before the AI call.
 * Updates the last accessed timestamp.
 * @param sessionId The ID of the session.
 * @param messageToAdd The message to add.
 */
export function addMessageToHistory(sessionId: string, messageToAdd: BackendChatMessage | FunctionCallOutputMessage): void {
    const sessionData = sessions.get(sessionId);
    if (sessionData) {
        sessionData.chatHistory.push(messageToAdd as HistoryMessage);
        sessionData.lastAccessed = Date.now();
        logger.debug({ sessionId, historyLength: sessionData.chatHistory.length }, "Message added to session history");
    } else {
        logger.warn({ sessionId }, "Attempted to add message to non-existent session");
    }
}

/**
 * Gets the current count of active (non-expired) sessions.
 * @returns The number of active sessions.
 */
export function getActiveSessionCount(): number {
  // Filter out potentially expired sessions just in case cleanup hasn't run
  const now = Date.now();
  let activeCount = 0;
  sessions.forEach(session => {
      if (now - session.lastAccessed <= SESSION_TTL) {
          activeCount++;
      }
  });
  return activeCount;
  // Or simply return sessions.size if TTL check isn't critical here
  // return sessions.size;
}