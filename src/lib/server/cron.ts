import { HttpError } from "./db";

// The cron routes' one rule (/api/cron/*): Authorization: Bearer <CRON_SECRET>, the same value in Vercel and the bot VM's
// .env (docs/HOSTING.md). Never open: each call can wake the database and ask outside services.
export function requireCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new HttpError(503, "CRON_SECRET isn't set");
  if (req.headers.get("authorization") !== `Bearer ${secret}`) throw new HttpError(401, "Bad cron secret");
}
