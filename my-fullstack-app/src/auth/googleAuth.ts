import { OAuth2Client } from 'google-auth-library';
import { Request, Response } from 'express';
import { User } from '../db/real/utente'; // Adjust the import based on your user model

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

const client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

export const googleAuth = async (req: Request, res: Response) => {
    const { token } = req.body;

    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const userId = payload?.sub;
        const email = payload?.email;

        // Here you can create or find the user in your database
        const user = await User.findOrCreate({ googleId: userId, email });

        // Set up session or token as needed
        req.session.userId = user.id;

        res.status(200).json({ message: 'Authentication successful', user });
    } catch (error) {
        res.status(401).json({ message: 'Authentication failed', error });
    }
};