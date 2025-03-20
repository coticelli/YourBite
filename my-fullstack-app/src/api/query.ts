import { Pool } from 'pg'; // Assuming PostgreSQL is used, adjust if necessary
import { config } from '../config/env';

const pool = new Pool({
    connectionString: config.DATABASE_URL,
});

export const executeQuery = async (query: string, params: any[] = []) => {
    const client = await pool.connect();
    try {
        const res = await client.query(query, params);
        return res.rows;
    } catch (err) {
        throw new Error(`Query failed: ${err.message}`);
    } finally {
        client.release();
    }
};

export const getAllUsers = async () => {
    const query = 'SELECT * FROM users'; // Adjust table name as necessary
    return await executeQuery(query);
};

export const getUserById = async (id: number) => {
    const query = 'SELECT * FROM users WHERE id = $1'; // Adjust table name as necessary
    return await executeQuery(query, [id]);
};

// Additional query functions can be added here as needed.