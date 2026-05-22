// Idempotent pre-push migration for ConversationStatus enum.
// Old: { ACTIVE, CANCELLED, COMPLETED }
// New: { ACTIVE, PAUSED }
// Each step is wrapped in its own try/catch so a fresh DB (no enum yet) is fine.
//
// Order matters:
//   1. Map COMPLETED rows to ACTIVE (no UX flow ever populated COMPLETED).
//   2. Rename enum value CANCELLED -> PAUSED. Preserves existing rows.
//   3. `prisma db push` afterwards drops COMPLETED from the enum.

const { PrismaClient } = require('@prisma/client');

(async () => {
  if (!process.env.DATABASE_URL) {
    console.log('[migrate-statuses] DATABASE_URL missing, skipping');
    return;
  }

  const prisma = new PrismaClient();

  const exec = async (label, sql) => {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log(`[migrate-statuses] ok: ${label}`);
    } catch (e) {
      console.log(`[migrate-statuses] skip (${label}): ${e.message}`);
    }
  };

  await exec(
    'COMPLETED -> ACTIVE',
    `UPDATE "Conversation" SET status = 'ACTIVE' WHERE status::text = 'COMPLETED'`
  );
  await exec(
    'rename CANCELLED -> PAUSED',
    `ALTER TYPE "ConversationStatus" RENAME VALUE 'CANCELLED' TO 'PAUSED'`
  );

  await prisma.$disconnect();
})().catch((e) => {
  console.log('[migrate-statuses] fatal (ignored):', e.message);
  process.exit(0);
});
