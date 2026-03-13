import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../config/database";

const JWT_SECRET = process.env.JWT_SECRET || "change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const SALT_ROUNDS = 12;

export interface AuthUser {
  id: string;
  email: string;
}

export async function createUser(
  email: string,
  password: string,
  fullName: string
): Promise<AuthUser> {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO users (email, password_hash, raw_user_meta_data)
       VALUES ($1, $2, $3) RETURNING id, email`,
      [email.toLowerCase().trim(), passwordHash, JSON.stringify({ full_name: fullName })]
    );

    const user = rows[0];

    await client.query(
      `INSERT INTO profiles (user_id, full_name) VALUES ($1, $2)`,
      [user.id, fullName]
    );

    await client.query("COMMIT");
    return user;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function createUserWithCompany(
  email: string,
  password: string,
  fullName: string,
  companyId: string,
  role: string = "admin"
): Promise<AuthUser> {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO users (email, password_hash, email_confirmed, raw_user_meta_data)
       VALUES ($1, $2, true, $3) RETURNING id, email`,
      [email.toLowerCase().trim(), passwordHash, JSON.stringify({ full_name: fullName })]
    );

    const user = rows[0];

    await client.query(
      `INSERT INTO profiles (user_id, full_name, company_id, role, password_changed)
       VALUES ($1, $2, $3, $4, false)`,
      [user.id, fullName, companyId, role]
    );

    await client.query("COMMIT");
    return user;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function authenticateUser(
  email: string,
  password: string
): Promise<{ token: string; user: AuthUser }> {
  const { rows } = await pool.query(
    `SELECT id, email, password_hash FROM users WHERE email = $1`,
    [email.toLowerCase().trim()]
  );

  if (!rows[0]) throw new Error("Credenciais inválidas");

  const valid = await bcrypt.compare(password, rows[0].password_hash);
  if (!valid) throw new Error("Credenciais inválidas");

  const token = jwt.sign(
    { sub: rows[0].id, email: rows[0].email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );

  return { token, user: { id: rows[0].id, email: rows[0].email } };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const { rows } = await pool.query(
    `SELECT password_hash FROM users WHERE id = $1`,
    [userId]
  );

  if (!rows[0]) throw new Error("Usuário não encontrado");

  const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!valid) throw new Error("Senha atual incorreta");

  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
    newHash,
    userId,
  ]);

  await pool.query(
    `UPDATE profiles SET password_changed = true WHERE user_id = $1`,
    [userId]
  );
}

export async function resetPassword(
  userId: string,
  newPassword: string
): Promise<void> {
  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
    newHash,
    userId,
  ]);
}

export function generateToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}
