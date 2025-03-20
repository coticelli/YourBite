import { Pool } from 'pg'; // Assuming PostgreSQL is used, adjust if necessary
import { Role } from '../../models/Role'; // Adjust the import path based on your project structure

const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // Ensure this is set in your .env file
});

export const getRoles = async (): Promise<Role[]> => {
    const result = await pool.query('SELECT * FROM roles');
    return result.rows;
};

export const getRoleById = async (id: number): Promise<Role | null> => {
    const result = await pool.query('SELECT * FROM roles WHERE id = $1', [id]);
    return result.rows.length ? result.rows[0] : null;
};

export const createRole = async (role: Role): Promise<Role> => {
    const result = await pool.query(
        'INSERT INTO roles(name, description) VALUES($1, $2) RETURNING *',
        [role.name, role.description]
    );
    return result.rows[0];
};

export const updateRole = async (id: number, role: Role): Promise<Role | null> => {
    const result = await pool.query(
        'UPDATE roles SET name = $1, description = $2 WHERE id = $3 RETURNING *',
        [role.name, role.description, id]
    );
    return result.rows.length ? result.rows[0] : null;
};

export const deleteRole = async (id: number): Promise<boolean> => {
    const result = await pool.query('DELETE FROM roles WHERE id = $1', [id]);
    return result.rowCount > 0;
};