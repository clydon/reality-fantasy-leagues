// Dev-only: makes sure the local database has a super-admin account to sign in with. Idempotent --
// run it any time (`node db/seed-dev-admin.js`), e.g. after recreating the database. If an account
// with this username or email already exists it's promoted in place (username set, role=admin,
// password reset to the value below); otherwise one is created. Never run against a real database.
// Override the defaults with SEED_ADMIN_USERNAME / SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const { Pool } = require("pg");

const USERNAME = process.env.SEED_ADMIN_USERNAME || "conor";
const EMAIL = (process.env.SEED_ADMIN_EMAIL || "dev-admin@example.invalid").toLowerCase();
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || "devpass123";

// Better Auth's own id format is just a random alphanumeric string; anything unique works here.
function genId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(crypto.randomBytes(32), (b) => chars[b % chars.length]).join("");
}

async function seed(pool) {
  // Same hasher Better Auth uses for email+password sign-in (auth.ts leaves it at the default).
  const { hashPassword } = await import("better-auth/crypto");
  const hash = await hashPassword(PASSWORD);
  const username = USERNAME.toLowerCase(); // the username plugin stores the normalized form

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`SELECT id FROM "user" WHERE username=$1 OR lower(email)=$2`, [username, EMAIL]);
    if (rows.length > 1) throw new Error(`username "${username}" and email "${EMAIL}" belong to two different accounts -- resolve by hand`);

    let userId;
    if (rows.length) {
      userId = rows[0].id;
      await client.query(
        `UPDATE "user" SET username=$2, "displayUsername"=$3, role='admin', "updatedAt"=now() WHERE id=$1`,
        [userId, username, USERNAME]
      );
    } else {
      userId = genId();
      await client.query(
        // true: a dev seed shouldn't get locked out by requireEmailVerification (auth.ts) --
        // there's no inbox to click a link in during a local setup.
        `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, true, $4, $2, 'admin', now(), now())`,
        [userId, USERNAME, EMAIL, username]
      );
    }

    const cred = await client.query(`SELECT id FROM account WHERE "userId"=$1 AND "providerId"='credential'`, [userId]);
    if (cred.rows.length) {
      await client.query(`UPDATE account SET password=$2, "updatedAt"=now() WHERE id=$1`, [cred.rows[0].id, hash]);
    } else {
      await client.query(
        `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
         VALUES ($1, $2, 'credential', $2, $3, now(), now())`,
        [genId(), userId, hash]
      );
    }
    await client.query("COMMIT");
    console.log(`[seed] ${rows.length ? "updated" : "created"} super-admin "${username}" (${EMAIL})`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  seed(pool)
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

module.exports = { seed };
