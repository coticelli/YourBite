import { Request, Response } from 'express';
import { destroySession } from './session';

export const logout = (req: Request, res: Response) => {
    destroySession(req);
    res.status(200).json({ message: 'Logout successful' });
};