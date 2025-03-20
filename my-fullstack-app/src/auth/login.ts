import { Request, Response } from 'express';
import { createSession } from './session';
import { authenticateUser } from '../db/mock/utente'; // or '../db/real/utente' for real implementation

export const login = async (req: Request, res: Response) => {
    const { username, password } = req.body;

    try {
        const user = await authenticateUser(username, password);
        
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const sessionToken = createSession(user.id);
        return res.status(200).json({ message: 'Login successful', token: sessionToken });
    } catch (error) {
        return res.status(500).json({ message: 'Internal server error', error });
    }
};