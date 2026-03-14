import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar
} from "drizzle-orm/pg-core";
import {
  EXPENSE_CATEGORIES,
  GOAL_STATUSES,
  INCOME_CATEGORIES
} from "../constants";

export const goalStatusEnum = pgEnum("goal_status", GOAL_STATUSES);
export const expenseCategoryEnum = pgEnum(
  "expense_category",
  EXPENSE_CATEGORIES
);
export const incomeCategoryEnum = pgEnum("income_category", INCOME_CATEGORIES);

export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 32 }).notNull(),
  guildId: varchar("guild_id", { length: 32 }).notNull(),
  channelId: varchar("channel_id", { length: 32 }).notNull(),
  name: text("name").notNull(),
  deadline: timestamp("deadline", { withTimezone: true, mode: "date" }).notNull(),
  status: goalStatusEnum("status").notNull().default("PENDING"),
  reminderSent: boolean("reminder_sent").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 32 }).notNull(),
  guildId: varchar("guild_id", { length: 32 }).notNull(),
  description: text("description").notNull(),
  amountPkr: integer("amount_pkr").notNull(),
  date: timestamp("date", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  category: expenseCategoryEnum("category").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
});

export const incomes = pgTable("incomes", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 32 }).notNull(),
  guildId: varchar("guild_id", { length: 32 }).notNull(),
  description: text("description").notNull(),
  amountPkr: integer("amount_pkr").notNull(),
  date: timestamp("date", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  category: incomeCategoryEnum("category").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
});
