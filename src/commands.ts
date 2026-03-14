import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Interaction,
  ModalBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { expenses, goals, incomes } from "./db/schema";
import { EXPENSE_CATEGORIES, GOAL_STATUSES, INCOME_CATEGORIES } from "./constants";
import { formatShortDate, parseNaturalLanguageDate } from "./utils/date";
import { inngest } from "./services/inngest";

type GoalStatus = (typeof GOAL_STATUSES)[number];
type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
type IncomeCategory = (typeof INCOME_CATEGORIES)[number];

const isGoalStatus = (value: string): value is GoalStatus =>
  (GOAL_STATUSES as readonly string[]).includes(value);
const isExpenseCategory = (value: string): value is ExpenseCategory =>
  (EXPENSE_CATEGORIES as readonly string[]).includes(value);
const isIncomeCategory = (value: string): value is IncomeCategory =>
  (INCOME_CATEGORIES as readonly string[]).includes(value);

const pingCommand = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Check bot latency");

const healthCommand = new SlashCommandBuilder()
  .setName("healthcheck")
  .setDescription("Check database connectivity");

const goalCommand = new SlashCommandBuilder()
  .setName("goal")
  .setDescription("Manage goals")
  .addSubcommand((sub) =>
    sub.setName("create").setDescription("Create a goal (modal input)")
  )
  .addSubcommand((sub) =>
    sub.setName("view").setDescription("View your goals")
  )
  .addSubcommand((sub) =>
    sub
      .setName("status")
      .setDescription("Set goal status")
      .addIntegerOption((opt) =>
        opt.setName("id").setDescription("Goal ID").setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("status")
          .setDescription("New status")
          .setRequired(true)
          .addChoices(...GOAL_STATUSES.map((status) => ({ name: status, value: status })))
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("edit")
      .setDescription("Edit goal name and deadline")
      .addIntegerOption((opt) =>
        opt.setName("id").setDescription("Goal ID").setRequired(true)
      )
  );

const expenseCommand = new SlashCommandBuilder()
  .setName("expense")
  .setDescription("Track expenses")
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Add an expense")
      .addStringOption((opt) =>
        opt.setName("description").setDescription("What was it for?").setRequired(true)
      )
      .addNumberOption((opt) =>
        opt.setName("amount").setDescription("Amount in PKR").setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("category")
          .setDescription("Expense category")
          .setRequired(true)
          .addChoices(
            ...EXPENSE_CATEGORIES.map((cat) => ({
              name: cat,
              value: cat
            }))
          )
      )
      .addStringOption((opt) =>
        opt
          .setName("date")
          .setDescription("Date (e.g. today, tomorrow, 2026-03-14)")
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("list")
      .setDescription("List recent expenses")
  )
  .addSubcommand((sub) =>
    sub
      .setName("edit")
      .setDescription("Edit an expense")
      .addIntegerOption((opt) =>
        opt.setName("id").setDescription("Expense ID").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("description").setDescription("New description").setRequired(false)
      )
      .addNumberOption((opt) =>
        opt.setName("amount").setDescription("New amount in PKR").setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("category")
          .setDescription("New category")
          .setRequired(false)
          .addChoices(
            ...EXPENSE_CATEGORIES.map((cat) => ({
              name: cat,
              value: cat
            }))
          )
      )
      .addStringOption((opt) =>
        opt
          .setName("date")
          .setDescription("New date (e.g. 2026-03-14, yesterday)")
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("delete")
      .setDescription("Delete an expense")
      .addIntegerOption((opt) =>
        opt.setName("id").setDescription("Expense ID").setRequired(true)
      )
  );

const incomeCommand = new SlashCommandBuilder()
  .setName("income")
  .setDescription("Track income")
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Add income")
      .addStringOption((opt) =>
        opt.setName("description").setDescription("Source").setRequired(true)
      )
      .addNumberOption((opt) =>
        opt.setName("amount").setDescription("Amount in PKR").setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("category")
          .setDescription("Income category")
          .setRequired(true)
          .addChoices(
            ...INCOME_CATEGORIES.map((cat) => ({
              name: cat,
              value: cat
            }))
          )
      )
      .addStringOption((opt) =>
        opt
          .setName("date")
          .setDescription("Date (e.g. today, 2026-03-14)")
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("list")
      .setDescription("List recent income")
  )
  .addSubcommand((sub) =>
    sub
      .setName("edit")
      .setDescription("Edit income")
      .addIntegerOption((opt) =>
        opt.setName("id").setDescription("Income ID").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("description").setDescription("New description").setRequired(false)
      )
      .addNumberOption((opt) =>
        opt.setName("amount").setDescription("New amount in PKR").setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("category")
          .setDescription("New category")
          .setRequired(false)
          .addChoices(
            ...INCOME_CATEGORIES.map((cat) => ({
              name: cat,
              value: cat
            }))
          )
      )
      .addStringOption((opt) =>
        opt
          .setName("date")
          .setDescription("New date (e.g. 2026-03-14, yesterday)")
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("delete")
      .setDescription("Delete income")
      .addIntegerOption((opt) =>
        opt.setName("id").setDescription("Income ID").setRequired(true)
      )
  );

export const commandDefinitions = [
  pingCommand,
  healthCommand,
  goalCommand,
  expenseCommand,
  incomeCommand
];

export const commandPayloads = commandDefinitions.map((command) =>
  command.toJSON()
);

export async function handleInteraction(interaction: Interaction) {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "ping") {
      await interaction.reply(`Pong! ${interaction.client.ws.ping}ms`);
      return;
    }

    if (interaction.commandName === "healthcheck") {
      try {
        await db.execute(sql`select 1`);
        await interaction.reply("Database connection looks good.");
      } catch (error) {
        console.error(error);
        await interaction.reply("Database connection failed.");
      }
      return;
    }

    if (interaction.commandName === "goal") {
      await handleGoalCommand(interaction);
      return;
    }

    if (interaction.commandName === "expense") {
      await handleExpenseCommand(interaction);
      return;
    }

    if (interaction.commandName === "income") {
      await handleIncomeCommand(interaction);
      return;
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === "goal-create-modal") {
      await handleGoalCreateModal(interaction);
      return;
    }

    if (interaction.customId.startsWith("goal-edit-modal:")) {
      const goalId = Number(interaction.customId.split(":")[1]);
      await handleGoalEditModal(interaction, goalId);
      return;
    }
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === "goal-status-select") {
      await handleGoalStatusSelect(interaction);
      return;
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId.startsWith("goal-status-set:")) {
      await handleGoalStatusButton(interaction);
      return;
    }
  }
}

async function handleGoalCommand(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  if (!interaction.guildId) {
    await interaction.reply({ content: "Goals are only supported in servers." });
    return;
  }

  if (subcommand === "create") {
    const modal = new ModalBuilder()
      .setCustomId("goal-create-modal")
      .setTitle("Create Goal");

    const nameInput = new TextInputBuilder()
      .setCustomId("goal-name")
      .setLabel("Goal name")
      .setPlaceholder("Finish TypeScript course")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const deadlineInput = new TextInputBuilder()
      .setCustomId("goal-deadline")
      .setLabel("Deadline")
      .setPlaceholder("tomorrow 6pm, 2026-03-14 18:00")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(deadlineInput)
    );

    await interaction.showModal(modal);
    return;
  }

  if (subcommand === "view") {
    const list = await db
      .select()
      .from(goals)
      .where(and(eq(goals.userId, interaction.user.id), eq(goals.guildId, interaction.guildId)))
      .orderBy(desc(goals.deadline));

    if (list.length === 0) {
      await interaction.reply({ content: "No goals yet. Use /goal create to add one." });
      return;
    }

    const byStatus = groupBy(list, (goal) => goal.status);
    const sectionOrder = GOAL_STATUSES.filter((status) => byStatus.has(status));
    const sections = sectionOrder.map((status) => {
      const items = byStatus.get(status) ?? [];
      items.sort((a, b) => b.deadline.getTime() - a.deadline.getTime());
      const lines = items.map(
        (goal) =>
          `- #${goal.id} ${truncate(goal.name, 60)} — ${formatShortDate(goal.deadline)}`
      );
      return [`**${status}**`, ...lines].join("\n");
    });

    const options = list.slice(0, 25).map((goal) => ({
      label: `#${goal.id} ${truncate(goal.name, 50)}`,
      value: goal.id.toString(),
      description: `${goal.status} | ${formatShortDate(goal.deadline)}`
    }));

    const select = new StringSelectMenuBuilder()
      .setCustomId("goal-status-select")
      .setPlaceholder("Quick update goal status")
      .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

    await interaction.reply({
      content: `${sections.join("\n\n")}\n\nSelect a goal to update its status quickly.`,
      components: [row]
    });
    return;
  }

  if (subcommand === "status") {
    const id = interaction.options.getInteger("id", true);
    const statusInput = interaction.options.getString("status", true);
    if (!isGoalStatus(statusInput)) {
      await interaction.reply({ content: "Invalid goal status." });
      return;
    }
    const status = statusInput;

    const updated = await db
      .update(goals)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(goals.id, id), eq(goals.userId, interaction.user.id)))
      .returning();

    if (updated.length === 0) {
      await interaction.reply({ content: "Goal not found." });
      return;
    }

    await interaction.reply({
      content: `Goal #${id} status updated to ${status}.`
    });
    return;
  }

  if (subcommand === "edit") {
    const id = interaction.options.getInteger("id", true);

    const record = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, interaction.user.id)));

    if (record.length === 0) {
      await interaction.reply({ content: "Goal not found." });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`goal-edit-modal:${id}`)
      .setTitle(`Edit Goal #${id}`);

    const nameInput = new TextInputBuilder()
      .setCustomId("goal-name")
      .setLabel("Goal name")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue(record[0].name.slice(0, 100));

    const deadlineInput = new TextInputBuilder()
      .setCustomId("goal-deadline")
      .setLabel("Deadline")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue(formatShortDate(record[0].deadline));

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(deadlineInput)
    );

    await interaction.showModal(modal);
  }
}

async function handleGoalCreateModal(interaction: Interaction) {
  if (!interaction.isModalSubmit() || !interaction.guildId || !interaction.channelId) {
    return;
  }

  const name = interaction.fields.getTextInputValue("goal-name");
  const deadlineInput = interaction.fields.getTextInputValue("goal-deadline");
  const deadline = parseNaturalLanguageDate(deadlineInput);

  if (!deadline) {
    await interaction.reply({ content: "Could not parse the deadline. Try a clear date/time." });
    return;
  }

  const inserted = await db
    .insert(goals)
    .values({
      userId: interaction.user.id,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      name,
      deadline,
      status: "PENDING",
      reminderSent: false
    })
    .returning();

  const goal = inserted[0];

  try {
    await inngest.send({
      name: "goal/deadline.scheduled",
      data: {
        goalId: goal.id,
        deadline: goal.deadline.toISOString()
      }
    });
  } catch (error) {
    console.error("Failed to schedule deadline reminder", error);
  }

  await interaction.reply({
    content: `Goal created (#${goal.id}) with deadline ${formatShortDate(goal.deadline)}.`
  });
}

async function handleGoalEditModal(interaction: Interaction, goalId: number) {
  if (!interaction.isModalSubmit() || !interaction.guildId) {
    return;
  }

  const existing = await db
    .select()
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, interaction.user.id)));

  if (existing.length === 0) {
    await interaction.reply({ content: "Goal not found." });
    return;
  }

  const nameInput = interaction.fields.getTextInputValue("goal-name").trim();
  const deadlineInput = interaction.fields.getTextInputValue("goal-deadline").trim();
  const updates: {
    name?: string;
    deadline?: Date;
    reminderSent?: boolean;
    deadlineReminderSent?: boolean;
    updatedAt: Date;
  } = {
    updatedAt: new Date()
  };

  if (nameInput) {
    updates.name = nameInput;
  }

  if (deadlineInput) {
    const parsed = parseNaturalLanguageDate(deadlineInput);
    if (!parsed) {
      await interaction.reply({ content: "Could not parse the deadline." });
      return;
    }
    updates.deadline = parsed;
    updates.reminderSent = false;
    updates.deadlineReminderSent = false;
  }

  await db.update(goals).set(updates).where(eq(goals.id, goalId));

  if (updates.deadline) {
    try {
      await inngest.send({
        name: "goal/deadline.scheduled",
        data: {
          goalId,
          deadline: updates.deadline.toISOString()
        }
      });
    } catch (error) {
      console.error("Failed to reschedule deadline reminder", error);
    }
  }

  await interaction.reply({
    content: `Goal #${goalId} updated.`
  });
}

async function handleGoalStatusSelect(interaction: Interaction) {
  if (!interaction.isStringSelectMenu()) return;

  const goalId = interaction.values[0];
  const goal = await db
    .select()
    .from(goals)
    .where(and(eq(goals.id, Number(goalId)), eq(goals.userId, interaction.user.id)));

  if (goal.length === 0) {
    await interaction.reply({ content: "Goal not found." });
    return;
  }

  const buttons = GOAL_STATUSES.map((status) =>
    new ButtonBuilder()
      .setCustomId(`goal-status-set:${goalId}:${status}`)
      .setLabel(status)
      .setStyle(status === "COMPLETED" ? ButtonStyle.Success : ButtonStyle.Secondary)
  );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(0, 5));

  await interaction.reply({
    content: `Pick a status for goal #${goalId}:`,
    components: [row]
  });
}

async function handleGoalStatusButton(interaction: Interaction) {
  if (!interaction.isButton()) return;

  const [, goalId, statusInput] = interaction.customId.split(":");
  if (!statusInput || !isGoalStatus(statusInput)) {
    await interaction.reply({ content: "Invalid goal status." });
    return;
  }
  const status = statusInput;
  const updated = await db
    .update(goals)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(goals.id, Number(goalId)), eq(goals.userId, interaction.user.id)))
    .returning();

  if (updated.length === 0) {
    await interaction.reply({ content: "Goal not found." });
    return;
  }

  await interaction.reply({
    content: `Goal #${goalId} set to ${status}.`
  });
}

async function handleExpenseCommand(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (!interaction.guildId) {
    await interaction.reply({ content: "Expenses are only supported in servers." });
    return;
  }

  if (sub === "add") {
    const description = interaction.options.getString("description", true);
    const amount = interaction.options.getNumber("amount", true);
    const categoryInput = interaction.options.getString("category", true);
    if (!isExpenseCategory(categoryInput)) {
      await interaction.reply({ content: "Invalid expense category." });
      return;
    }
    const category = categoryInput;
    const dateText = interaction.options.getString("date");
    const date = dateText ? parseNaturalLanguageDate(dateText) : new Date();

    if (!date) {
      await interaction.reply({ content: "Could not parse the date." });
      return;
    }

    const inserted = await db
      .insert(expenses)
      .values({
        userId: interaction.user.id,
        guildId: interaction.guildId,
        description,
        amountPkr: Math.round(amount),
        category,
        date
      })
      .returning();

    await interaction.reply({
      content: `Expense #${inserted[0].id} saved (${Math.round(amount)} PKR).`
    });
    return;
  }

  if (sub === "list") {
    const list = await db
      .select()
      .from(expenses)
      .where(and(eq(expenses.userId, interaction.user.id), eq(expenses.guildId, interaction.guildId)))
      .orderBy(desc(expenses.date))
      .limit(20);

    if (list.length === 0) {
      await interaction.reply({ content: "No expenses yet." });
      return;
    }

    const byCategory = groupBy(list, (expense) => expense.category);
    const sectionOrder = EXPENSE_CATEGORIES.filter((cat) => byCategory.has(cat));
    const sections = sectionOrder.map((cat) => {
      const items = byCategory.get(cat) ?? [];
      items.sort((a, b) => b.date.getTime() - a.date.getTime());
      const lines = items.map(
        (expense) =>
          `- #${expense.id} ${truncate(expense.description, 60)} — ${expense.amountPkr} PKR — ${formatShortDate(expense.date)}`
      );
      return [`**${cat}**`, ...lines].join("\n");
    });

    await interaction.reply({ content: sections.join("\n\n") });
    return;
  }

  if (sub === "edit") {
    const id = interaction.options.getInteger("id", true);
    const description = interaction.options.getString("description");
    const amount = interaction.options.getNumber("amount");
    const categoryInput = interaction.options.getString("category");
    const dateText = interaction.options.getString("date");

    const updates: {
      description?: string;
      amountPkr?: number;
      category?: ExpenseCategory;
      date?: Date;
    } = {};

    if (description) updates.description = description;
    if (amount !== null && amount !== undefined) updates.amountPkr = Math.round(amount);
    if (categoryInput) {
      if (!isExpenseCategory(categoryInput)) {
        await interaction.reply({ content: "Invalid expense category." });
        return;
      }
      updates.category = categoryInput;
    }
    if (dateText) {
      const parsed = parseNaturalLanguageDate(dateText);
      if (!parsed) {
        await interaction.reply({ content: "Could not parse the date." });
        return;
      }
      updates.date = parsed;
    }

    if (Object.keys(updates).length === 0) {
      await interaction.reply({ content: "No updates provided." });
      return;
    }

    const updated = await db
      .update(expenses)
      .set(updates)
      .where(and(eq(expenses.id, id), eq(expenses.userId, interaction.user.id)))
      .returning();

    if (updated.length === 0) {
      await interaction.reply({ content: "Expense not found." });
      return;
    }

    await interaction.reply({ content: `Expense #${id} updated.` });
    return;
  }

  if (sub === "delete") {
    const id = interaction.options.getInteger("id", true);
    const deleted = await db
      .delete(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.userId, interaction.user.id)))
      .returning();

    if (deleted.length === 0) {
      await interaction.reply({ content: "Expense not found." });
      return;
    }

    await interaction.reply({ content: `Expense #${id} deleted.` });
  }
}

async function handleIncomeCommand(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (!interaction.guildId) {
    await interaction.reply({ content: "Income tracking is only supported in servers." });
    return;
  }

  if (sub === "add") {
    const description = interaction.options.getString("description", true);
    const amount = interaction.options.getNumber("amount", true);
    const categoryInput = interaction.options.getString("category", true);
    if (!isIncomeCategory(categoryInput)) {
      await interaction.reply({ content: "Invalid income category." });
      return;
    }
    const category = categoryInput;
    const dateText = interaction.options.getString("date");
    const date = dateText ? parseNaturalLanguageDate(dateText) : new Date();

    if (!date) {
      await interaction.reply({ content: "Could not parse the date." });
      return;
    }

    const inserted = await db
      .insert(incomes)
      .values({
        userId: interaction.user.id,
        guildId: interaction.guildId,
        description,
        amountPkr: Math.round(amount),
        category,
        date
      })
      .returning();

    await interaction.reply({
      content: `Income #${inserted[0].id} saved (${Math.round(amount)} PKR).`
    });
    return;
  }

  if (sub === "list") {
    const list = await db
      .select()
      .from(incomes)
      .where(and(eq(incomes.userId, interaction.user.id), eq(incomes.guildId, interaction.guildId)))
      .orderBy(desc(incomes.date))
      .limit(20);

    if (list.length === 0) {
      await interaction.reply({ content: "No income yet." });
      return;
    }

    const byCategory = groupBy(list, (income) => income.category);
    const sectionOrder = INCOME_CATEGORIES.filter((cat) => byCategory.has(cat));
    const sections = sectionOrder.map((cat) => {
      const items = byCategory.get(cat) ?? [];
      items.sort((a, b) => b.date.getTime() - a.date.getTime());
      const lines = items.map(
        (income) =>
          `- #${income.id} ${truncate(income.description, 60)} — ${income.amountPkr} PKR — ${formatShortDate(income.date)}`
      );
      return [`**${cat}**`, ...lines].join("\n");
    });

    await interaction.reply({ content: sections.join("\n\n") });
    return;
  }

  if (sub === "edit") {
    const id = interaction.options.getInteger("id", true);
    const description = interaction.options.getString("description");
    const amount = interaction.options.getNumber("amount");
    const categoryInput = interaction.options.getString("category");
    const dateText = interaction.options.getString("date");

    const updates: {
      description?: string;
      amountPkr?: number;
      category?: IncomeCategory;
      date?: Date;
    } = {};

    if (description) updates.description = description;
    if (amount !== null && amount !== undefined) updates.amountPkr = Math.round(amount);
    if (categoryInput) {
      if (!isIncomeCategory(categoryInput)) {
        await interaction.reply({ content: "Invalid income category." });
        return;
      }
      updates.category = categoryInput;
    }
    if (dateText) {
      const parsed = parseNaturalLanguageDate(dateText);
      if (!parsed) {
        await interaction.reply({ content: "Could not parse the date." });
        return;
      }
      updates.date = parsed;
    }

    if (Object.keys(updates).length === 0) {
      await interaction.reply({ content: "No updates provided." });
      return;
    }

    const updated = await db
      .update(incomes)
      .set(updates)
      .where(and(eq(incomes.id, id), eq(incomes.userId, interaction.user.id)))
      .returning();

    if (updated.length === 0) {
      await interaction.reply({ content: "Income record not found." });
      return;
    }

    await interaction.reply({ content: `Income #${id} updated.` });
    return;
  }

  if (sub === "delete") {
    const id = interaction.options.getInteger("id", true);
    const deleted = await db
      .delete(incomes)
      .where(and(eq(incomes.id, id), eq(incomes.userId, interaction.user.id)))
      .returning();

    if (deleted.length === 0) {
      await interaction.reply({ content: "Income record not found." });
      return;
    }

    await interaction.reply({ content: `Income #${id} deleted.` });
  }
}

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  if (max <= 3) return text.slice(0, max);
  return `${text.slice(0, max - 3)}...`;
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const group = map.get(key);
    if (group) {
      group.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return map;
}
