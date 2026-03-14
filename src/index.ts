import "dotenv/config";
import { createServer } from "node:http";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { handleInteraction } from "./commands";
import { setReminderClient, startGoalReminderWorker } from "./services/reminders";

const token = process.env.DISCORD_TOKEN;

if (!token) {
  throw new Error("DISCORD_TOKEN is not set");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user?.tag}`);
  setReminderClient(client);
  void startGoalReminderWorker();
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
        await interaction.followUp({ content });
      } else {
        await interaction.reply({ content });
      }
    }
  }
});

client.login(token);

const healthPort = Number(process.env.HEALTHCHECK_PORT ?? "3000");
const healthPath = process.env.HEALTHCHECK_PATH ?? "/healthz";

createServer((req, res) => {
  if (req.method === "GET" && req.url === healthPath) {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("not found");
}).listen(healthPort, () => {
  console.log(`Healthcheck listening on http://localhost:${healthPort}${healthPath}`);
});
