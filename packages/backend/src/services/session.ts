import { randomUUID } from "crypto";
import { ChatHistory } from "../types"; // Import ChatHistory type

// 会话数据接口
export interface SessionData {
  lastResponseId: string | null;
  chatHistory: ChatHistory; // Add chat history to session data
  lastAccessed: number; // 添加最后访问时间戳
}

// 会话有效期（毫秒），默认24小时
const SESSION_TTL = 24 * 60 * 60 * 1000;

// 清理间隔（毫秒），默认1小时
const CLEANUP_INTERVAL = 60 * 60 * 1000;

// 使用内存存储会话ID (生产环境应使用持久化存储)
const sessions: Map<string, SessionData> = new Map();

// 定期清理过期会话
function setupSessionCleanup() {
  setInterval(() => {
    const now = Date.now();
    let expiredCount = 0;
    
    sessions.forEach((session, sessionId) => {
      if (now - session.lastAccessed > SESSION_TTL) {
        sessions.delete(sessionId);
        expiredCount++;
      }
    });
    
    if (expiredCount > 0) {
      console.log(`已清理 ${expiredCount} 个过期会话，当前会话数: ${sessions.size}`);
    }
  }, CLEANUP_INTERVAL);
  
  console.log('会话清理任务已启动');
}

// 启动会话清理任务
setupSessionCleanup();

/**
 * 获取会话数据，如果不存在则创建新的
 */
export function getOrCreateSession(requestSessionId?: string): {
  sessionId: string;
  sessionData: SessionData;
  isNewSession: boolean;
} {
  // 如果没有提供sessionId，则自动生成一个
  const sessionId = requestSessionId || randomUUID();
  let isNewSession = false;

  // 获取或创建会话数据
  let sessionData = sessions.get(sessionId);
  if (!sessionData) {
    // Initialize with empty history when creating a new session
    sessionData = { 
      lastResponseId: null, 
      chatHistory: [],
      lastAccessed: Date.now()
    }; 
    sessions.set(sessionId, sessionData);
    isNewSession = true;
  } else {
    // 更新最后访问时间
    sessionData.lastAccessed = Date.now();
  }

  return { sessionId, sessionData, isNewSession };
}

/**
 * 检查会话是否有效
 * @param sessionId 会话ID
 * @returns 会话是否有效
 */
export function isValidSession(sessionId: string): boolean {
  // 检查会话是否存在
  if (!sessions.has(sessionId)) {
    return false;
  }
  
  // 检查会话是否过期
  const session = sessions.get(sessionId)!;
  const now = Date.now();
  const isExpired = now - session.lastAccessed > SESSION_TTL;
  
  // 如果过期，删除会话
  if (isExpired) {
    sessions.delete(sessionId);
    return false;
  }
  
  return true;
}

/**
 * 更新会话数据 (包括最后响应ID和聊天历史)
 */
export function updateSessionData(
  sessionId: string,
  responseId: string,
  updatedHistory: ChatHistory
): void {
  const sessionData = sessions.get(sessionId);
  if (sessionData) {
    sessionData.lastResponseId = responseId;
    sessionData.chatHistory = updatedHistory;
    sessionData.lastAccessed = Date.now(); // 更新最后访问时间
  }
}

/**
 * 获取当前活跃会话数量
 * @returns 当前活跃会话数量
 */
export function getActiveSessionCount(): number {
  return sessions.size;
} 