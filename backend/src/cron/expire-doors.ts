import cron from "node-cron";
import { pool } from "../config/database";

/**
 * Cron job para expirar portas de armários automaticamente.
 * Executa a cada 5 minutos.
 * Substitui a Edge Function "expire-locker-doors".
 */
export function startExpireDoorsJob() {
  cron.schedule("*/5 * * * *", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Expirar reservas ativas
      const { rowCount: expiredReservations } = await client.query(`
        UPDATE locker_reservations
        SET status = 'expired', released_at = NOW(), updated_at = NOW()
        WHERE status = 'active'
          AND expires_at IS NOT NULL
          AND expires_at < NOW()
      `);

      // 2. Liberar portas expiradas
      const { rowCount: expiredDoors } = await client.query(`
        UPDATE locker_doors
        SET status = 'available',
            occupied_by = NULL,
            occupied_by_person = NULL,
            occupied_at = NULL,
            expires_at = NULL,
            scheduled_reservation_id = NULL,
            updated_at = NOW()
        WHERE status = 'occupied'
          AND usage_type = 'temporary'
          AND expires_at IS NOT NULL
          AND expires_at < NOW()
      `);

      // 3. Ativar reservas agendadas cujo horário chegou
      const { rows: scheduledDoors } = await client.query(`
        SELECT ld.id as door_id, lr.id as reservation_id, lr.person_id,
               lr.reserved_by, lr.expires_at, lr.usage_type
        FROM locker_doors ld
        JOIN locker_reservations lr ON lr.id = ld.scheduled_reservation_id
        WHERE ld.scheduled_reservation_id IS NOT NULL
          AND lr.status = 'scheduled'
          AND lr.starts_at <= NOW()
      `);

      for (const door of scheduledDoors) {
        await client.query(`
          UPDATE locker_doors SET
            status = 'occupied',
            occupied_by = $2,
            occupied_by_person = $3,
            occupied_at = NOW(),
            expires_at = $4,
            usage_type = $5,
            scheduled_reservation_id = NULL,
            updated_at = NOW()
          WHERE id = $1
        `, [door.door_id, door.reserved_by, door.person_id, door.expires_at, door.usage_type]);

        await client.query(`
          UPDATE locker_reservations SET status = 'active', updated_at = NOW()
          WHERE id = $1
        `, [door.reservation_id]);
      }

      await client.query("COMMIT");

      if (expiredDoors || expiredReservations || scheduledDoors.length) {
        console.log(
          `[CRON expire-doors] ${expiredDoors} portas liberadas, ${expiredReservations} reservas expiradas, ${scheduledDoors.length} agendamentos ativados`
        );
      }
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[CRON expire-doors] Erro:", err);
    } finally {
      client.release();
    }
  });

  console.log("⏰ Cron job expire-doors agendado (a cada 5 min)");
}
