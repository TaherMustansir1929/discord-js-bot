import { and, eq, gte, lt } from "drizzle-orm";
import cron from "node-cron";
import type { Client } from "discord.js";
import { db } from "../db";
import { goals } from "../db/schema";
import { formatShortDate } from "../utils/date";

const HALF_HOUR_MS = 30 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function startGoalReminderCron(client: Client) {
  const tz = process.env.REMINDER_CRON_TZ || "UTC";

  cron.schedule(
    "*/30 * * * *",
    async () => {
      const now = Date.now();
      const windowStart = new Date(now + ONE_DAY_MS - HALF_HOUR_MS);
      const windowEnd = new Date(now + ONE_DAY_MS + HALF_HOUR_MS);

      const upcoming = await db
        .select()
        .from(goals)
        .where(
          and(
            eq(goals.status, "PENDING"),
            eq(goals.reminderSent, false),
            gte(goals.deadline, windowStart),
            lt(goals.deadline, windowEnd)
          )
        );

      for (const goal of upcoming) {
        try {
          const channel = await client.channels.fetch(goal.channelId);
          if (!channel || !channel.isTextBased()) {
            continue;
          }

          await channel.send(
            [
              `Reminder: "${goal.name}" is due in 24 hours.`,
              `Deadline: ${formatShortDate(goal.deadline)}`
            ].join("\n")
          );

          await db
            .update(goals)
            .set({ reminderSent: true })
            .where(eq(goals.id, goal.id));
        } catch (error) {
          console.error("Reminder send failed", error);
        }
      }
    },
    { timezone: tz }
  );
}
