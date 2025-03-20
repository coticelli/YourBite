import { v4 as uuidv4 } from 'uuid';

interface Session {
    id: string;
    userId: string;
    createdAt: Date;
    expiresAt: Date;
}

const sessions: Map<string, Session> = new Map();

export const createSession = (userId: string, duration: number): Session => {
    const sessionId = uuidv4();
    const now = new Date();
    const session: Session = {
        id: sessionId,
        userId,
        createdAt: now,
        expiresAt: new Date(now.getTime() + duration),
    };
    sessions.set(sessionId, session);
    return session;
};

export const validateSession = (sessionId: string): Session | null => {
    const session = sessions.get(sessionId);
    if (session && session.expiresAt > new Date()) {
        return session;
    }
    return null;
};

export const destroySession = (sessionId: string): boolean => {
    return sessions.delete(sessionId);
};