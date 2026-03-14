import { connect } from "inngest/connect";
import { and, eq, gte, lt } from "drizzle-orm";
import type { Client, TextBasedChannel } from "discord.js";
import { db } from "../db";
import { goals } from "../db/schema";
import { formatShortDate } from "../utils/date";
import { inngest } from "./inngest";

const HALF_HOUR_MS = 30 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

let reminderClient: Client | null = null;
let workerStarted = false;

export function setReminderClient(client: Client) {
  reminderClient = client;
}

function getCronSchedule() {
  const tz = process.env.REMINDER_CRON_TZ || "UTC";
  return `TZ=${tz} */30 * * * *`;
}

export const goalReminderFunction = inngest.createFunction(
  { id: "goal-reminder-24h" },
  { cron: getCronSchedule() },
  async () => {
    if (!reminderClient) {
      throw new Error("Discord client is not initialized for reminders.");
    }

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
        const channel = await reminderClient.channels.fetch(goal.channelId);
        if (!channel || !channel.isTextBased() || !canSend(channel)) {
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
  }
);

type DeadlineEventData = {
  goalId: number;
  deadline: string;
};

export const goalDeadlineFunction = inngest.createFunction(
  { id: "goal-reminder-deadline" },
  { event: "goal/deadline.scheduled" },
  async ({ event, step }) => {
    if (!reminderClient) {
      throw new Error("Discord client is not initialized for reminders.");
    }

    const { goalId, deadline } = event.data as DeadlineEventData;
    const deadlineDate = new Date(deadline);

    await step.sleepUntil("wait-for-deadline", deadlineDate);

    const existing = await db
      .select()
      .from(goals)
      .where(eq(goals.id, goalId));

    if (existing.length === 0) return;
    const goal = existing[0];

    if (goal.status !== "PENDING") return;
    if (goal.deadlineReminderSent) return;
    if (goal.deadline.getTime() !== deadlineDate.getTime()) return;

    try {
      const channel = await reminderClient.channels.fetch(goal.channelId);
      if (!channel || !channel.isTextBased() || !canSend(channel)) {
        return;
      }

      await channel.send(
        [
          `Deadline reached: "${goal.name}"`,
          `Deadline: ${formatShortDate(goal.deadline)}`
        ].join("\n")
      );

      await db
        .update(goals)
        .set({ deadlineReminderSent: true })
        .where(eq(goals.id, goal.id));
    } catch (error) {
      console.error("Deadline reminder send failed", error);
    }
  }
);

export async function startGoalReminderWorker() {
  if (workerStarted) return;
  workerStarted = true;

  await connect({
    apps: [
      {
        client: inngest,
        functions: [goalReminderFunction, goalDeadlineFunction]
      }
    ]
  });
}

function canSend(channel: TextBasedChannel): channel is TextBasedChannel & { send: (...args: any[]) => Promise<any> } {
  return "send" in channel;
}
