import { Pool } from 'pg'; // Assuming PostgreSQL is used, adjust if necessary
import { Profile } from '../../models/Profile'; // Adjust the import path based on your models structure

const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // Ensure this is set in your .env file
});

export const getProfiles = async (): Promise<Profile[]> => {
    const result = await pool.query('SELECT * FROM profiles');
    return result.rows;
};

export const getProfileById = async (id: number): Promise<Profile | null> => {
    const result = await pool.query('SELECT * FROM profiles WHERE id = $1', [id]);
    return result.rows.length ? result.rows[0] : null;
};

export const createProfile = async (profile: Profile): Promise<Profile> => {
    const result = await pool.query(
        'INSERT INTO profiles (name, age, bio) VALUES ($1, $2, $3) RETURNING *',
        [profile.name, profile.age, profile.bio]
    );
    return result.rows[0];
};

export const updateProfile = async (id: number, profile: Profile): Promise<Profile | null> => {
    const result = await pool.query(
        'UPDATE profiles SET name = $1, age = $2, bio = $3 WHERE id = $4 RETURNING *',
        [profile.name, profile.age, profile.bio, id]
    );
    return result.rows.length ? result.rows[0] : null;
};

export const deleteProfile = async (id: number): Promise<boolean> => {
    const result = await pool.query('DELETE FROM profiles WHERE id = $1', [id]);
    return result.rowCount > 0;
};