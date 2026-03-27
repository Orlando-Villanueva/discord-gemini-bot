import "dotenv/config";
import { REST, Routes } from "discord.js";
import { commands } from "./commands.js";

function requiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function main() {
  const token = requiredEnv("DISCORD_TOKEN");
  const clientId = requiredEnv("DISCORD_CLIENT_ID");
  const guildId = process.env.DISCORD_GUILD_ID?.trim();

  const rest = new REST({ version: "10" }).setToken(token);
  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);

  console.log(
    guildId
      ? `Registering ${commands.length} guild command(s) to ${guildId}...`
      : `Registering ${commands.length} global command(s)...`,
  );

  await rest.put(route, { body: commands });

  console.log("Command registration complete.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
