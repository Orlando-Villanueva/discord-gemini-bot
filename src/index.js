import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
} from "discord.js";

function requiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parseIntegerEnv(name, fallback) {
  const rawValue = process.env[name];

  if (rawValue === undefined || rawValue === "") {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }

  return parsed;
}

function chunkForDiscord(text, maxLength = 1900) {
  const chunks = [];
  let remaining = text.trim();

  while (remaining.length > maxLength) {
    let splitIndex = remaining.lastIndexOf("\n", maxLength);

    if (splitIndex < Math.floor(maxLength * 0.6)) {
      splitIndex = remaining.lastIndexOf(" ", maxLength);
    }

    if (splitIndex < Math.floor(maxLength * 0.6)) {
      splitIndex = maxLength;
    }

    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks.length > 0 ? chunks : ["Gemini returned an empty response."];
}

async function sendDiscordReply(interaction, text, isPrivate) {
  const chunks = chunkForDiscord(text);
  const followUpOptions = isPrivate
    ? { flags: MessageFlags.Ephemeral }
    : undefined;

  await interaction.editReply(chunks[0]);

  for (const chunk of chunks.slice(1)) {
    if (followUpOptions) {
      await interaction.followUp({ content: chunk, ...followUpOptions });
    } else {
      await interaction.followUp({ content: chunk });
    }
  }
}

async function main() {
  const discordToken = requiredEnv("DISCORD_TOKEN");
  const geminiApiKey = requiredEnv("GEMINI_API_KEY");
  const geminiModel = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const geminiMaxOutputTokens = parseIntegerEnv(
    "GEMINI_MAX_OUTPUT_TOKENS",
    512,
  );
  const geminiThinkingBudget = parseIntegerEnv("GEMINI_THINKING_BUDGET", 0);
  const systemInstruction =
    process.env.SYSTEM_INSTRUCTION?.trim() ||
    "You are a helpful Discord assistant. Keep answers concise, clear, and friendly.";

  const ai = new GoogleGenAI({ apiKey: geminiApiKey });
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    if (interaction.commandName === "ping") {
      await interaction.reply({
        content: "Pong!",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.commandName !== "ask") {
      return;
    }

    const prompt = interaction.options.getString("prompt", true);
    const isPrivate = interaction.options.getBoolean("private") ?? false;

    await interaction.deferReply(
      isPrivate ? { flags: MessageFlags.Ephemeral } : {},
    );

    try {
      const response = await ai.models.generateContent({
        model: geminiModel,
        contents: prompt,
        config: {
          systemInstruction,
          maxOutputTokens: geminiMaxOutputTokens,
          thinkingConfig: {
            thinkingBudget: geminiThinkingBudget,
          },
        },
      });

      await sendDiscordReply(
        interaction,
        response.text?.trim() || "Gemini returned an empty response.",
        isPrivate,
      );
    } catch (error) {
      console.error("Gemini request failed:", error);

      const message =
        "I hit an error talking to Gemini. Check the logs and confirm your Discord and Gemini credentials are valid.";

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(message);
      } else if (isPrivate) {
        await interaction.reply({
          content: message,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({ content: message });
      }
    }
  });

  await client.login(discordToken);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
