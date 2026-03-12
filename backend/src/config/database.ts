import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("Erro inesperado no pool PostgreSQL:", err);
});

export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    console.log("✅ Conexão com PostgreSQL estabelecida");
    return true;
  } catch (err) {
    console.error("❌ Falha na conexão com PostgreSQL:", err);
    return false;
  }
}
