import "dotenv/config";
import { REST, Routes } from "discord.js";
import { commandPayloads } from "./commands";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId || !guildId) {
  throw new Error("DISCORD_TOKEN, DISCORD_CLIENT_ID, and DISCORD_GUILD_ID are required.");
}

const rest = new REST({ version: "10" }).setToken(token);

async function register() {
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commandPayloads
  });
  console.log("Commands registered.");
}

register().catch((error) => {
  console.error(error);
  process.exit(1);
});
