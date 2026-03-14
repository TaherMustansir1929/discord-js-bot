import "dotenv/config";
import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";
import { handleInteraction } from "./commands";
import { startGoalReminderCron } from "./services/reminders";

const token = process.env.DISCORD_TOKEN;

if (!token) {
  throw new Error("DISCORD_TOKEN is not set");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user?.tag}`);
  startGoalReminderCron(client);
});

client.on("interactionCreate", async (interaction) => {
  try {
    await handleInteraction(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.isRepliable()) {
      const hasReply = interaction.deferred || interaction.replied;
      const content = "Something went wrong while handling that interaction.";
      if (hasReply) {
        await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral });
      }
    }
  }
});

client.login(token);
