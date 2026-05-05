import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import {
  ActionRowBuilder,
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
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
  function findSplitIndex(segment) {
    const minimumSplit = Math.floor(maxLength * 0.6);
    const breakCandidates = [
      segment.lastIndexOf("\n\n", maxLength),
      segment.lastIndexOf("\n", maxLength),
      segment.lastIndexOf(". ", maxLength),
      segment.lastIndexOf("! ", maxLength),
      segment.lastIndexOf("? ", maxLength),
      segment.lastIndexOf("; ", maxLength),
      segment.lastIndexOf(", ", maxLength),
      segment.lastIndexOf(" ", maxLength),
    ];

    const viableBreak = breakCandidates.find((index) => index >= minimumSplit);

    if (viableBreak !== undefined) {
      return viableBreak + 1;
    }

    return maxLength;
  }

  function splitLongSegment(segment) {
    const segments = [];
    let remaining = segment.trim();

    while (remaining.length > maxLength) {
      const splitIndex = findSplitIndex(remaining);
      segments.push(remaining.slice(0, splitIndex).trim());
      remaining = remaining.slice(splitIndex).trim();
    }

    if (remaining) {
      segments.push(remaining);
    }

    return segments;
  }

  const chunks = [];
  const paragraphs = text.trim().split(/\n{2,}/).filter(Boolean);
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }

      chunks.push(...splitLongSegment(paragraph));
      continue;
    }

    const nextChunk = currentChunk
      ? `${currentChunk}\n\n${paragraph}`
      : paragraph;

    if (nextChunk.length <= maxLength) {
      currentChunk = nextChunk;
      continue;
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    currentChunk = paragraph;
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : ["Gemini returned an empty response."];
}

function extractTextFromParts(parts = []) {
  return parts
    .map((part) => part.text?.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractResponseText(response) {
  const directText = response.text?.trim();

  if (directText) {
    return directText;
  }

  const candidateParts = response.candidates?.flatMap(
    (candidate) => candidate.content?.parts || [],
  );
  const partsText = extractTextFromParts(candidateParts);

  if (partsText) {
    return partsText;
  }

  return "";
}

function formatModelText(response) {
  const extractedText = extractResponseText(response);
  const finishReason = response.candidates?.[0]?.finishReason;

  if (extractedText) {
    if (finishReason === "MAX_TOKENS") {
      return `${extractedText}\n\n[Response truncated because Gemini hit the output token limit. Raise GEMINI_MAX_OUTPUT_TOKENS or ask for a shorter answer.]`;
    }

    return extractedText;
  }

  const promptBlockReason = response.promptFeedback?.blockReason;

  if (promptBlockReason) {
    return `Gemini blocked the prompt (${promptBlockReason}). Try rephrasing it.`;
  }
  if (finishReason === "SAFETY") {
    return "Gemini blocked the response for safety reasons. Try rephrasing the request.";
  }

  if (finishReason === "RECITATION") {
    return "Gemini stopped because the reply risked reproducing source material too closely. Try making the prompt more specific or original.";
  }

  if (finishReason === "MAX_TOKENS") {
    return "Gemini ran out of output tokens. Raise GEMINI_MAX_OUTPUT_TOKENS or ask for a shorter answer.";
  }

  if (finishReason) {
    return `Gemini returned no text (finish reason: ${finishReason}). Try retrying or rephrasing the request.`;
  }

  return "Gemini returned an empty response. Try retrying the request.";
}

function describeGeminiError(error) {
  const sdkMessage = error?.message?.trim();
  const apiMessage = error?.error?.message?.trim();
  const status = error?.status;

  if (apiMessage && status) {
    return `${status}: ${apiMessage}`;
  }

  if (sdkMessage) {
    return sdkMessage;
  }

  return "Unknown Gemini API error.";
}

function parseYesNo(value) {
  const normalized = value?.trim().toLowerCase();

  return normalized === "y" || normalized === "yes" || normalized === "true";
}

function parseEmojiStyle(value) {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return "light";
  }

  if (normalized === "off" || normalized === "light") {
    return normalized;
  }

  throw new Error("DISCORD_EMOJI_STYLE must be either 'off' or 'light'.");
}

function buildSystemInstruction(baseInstruction, emojiStyle) {
  if (emojiStyle === "off") {
    return baseInstruction;
  }

  return [
    baseInstruction,
    "",
    "Emoji guidance: You may occasionally use a single well-chosen emoji when it adds warmth, clarity, or scannability.",
    "Keep emoji usage sparse and natural.",
    "Most replies should use no emoji; some can use one, and only rarely two.",
    "Do not add emoji to every response, do not stack or repeat them, and skip emoji for sensitive or serious topics.",
  ].join("\n");
}

function formatMessageContext(message) {
  const authorName =
    message.author?.globalName ||
    message.author?.displayName ||
    message.author?.username ||
    "Unknown author";
  const content = message.content?.trim() || "[No text content]";
  const attachments = [...message.attachments.values()]
    .slice(0, 5)
    .map((attachment) => attachment.url);
  const attachmentsBlock =
    attachments.length > 0
      ? `Attachments:\n${attachments.map((url) => `- ${url}`).join("\n")}`
      : "Attachments:\n- None";

  return [
    `Message author: ${authorName}`,
    `Message link: ${message.url || "Unavailable"}`,
    "Message content:",
    content,
    attachmentsBlock,
  ].join("\n");
}

function messageHasAnalyzableContent(message) {
  return Boolean(message.content?.trim()) || message.attachments.size > 0;
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

async function generateModelReply({
  ai,
  model,
  prompt,
  systemInstruction,
  maxOutputTokens,
  thinkingBudget,
  useSearch,
}) {
  const buildRequest = (activeModel, promptText) => ({
    model: activeModel,
    contents: promptText,
    config: {
      systemInstruction,
      maxOutputTokens,
      responseMimeType: "text/plain",
      tools: useSearch ? [{ googleSearch: {} }] : undefined,
      thinkingConfig: {
        includeThoughts: false,
        thinkingBudget,
      },
    },
  });
  const response = await ai.models.generateContent(buildRequest(model, prompt));

  return formatModelText(response);
}

async function main() {
  const discordToken = requiredEnv("DISCORD_TOKEN");
  const geminiApiKey = requiredEnv("GEMINI_API_KEY");
  const geminiModel =
    process.env.GEMINI_MODEL?.trim() || "gemini-3-flash-preview";
  const geminiMaxOutputTokens = parseIntegerEnv(
    "GEMINI_MAX_OUTPUT_TOKENS",
    512,
  );
  const geminiThinkingBudget = parseIntegerEnv("GEMINI_THINKING_BUDGET", 0);
  const baseSystemInstruction =
    process.env.SYSTEM_INSTRUCTION?.trim() ||
    "You are a helpful Discord assistant. Keep answers concise, clear, and friendly.";
  const emojiStyle = parseEmojiStyle(process.env.DISCORD_EMOJI_STYLE);
  const systemInstruction = buildSystemInstruction(
    baseSystemInstruction,
    emojiStyle,
  );

  const ai = new GoogleGenAI({ apiKey: geminiApiKey });
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}`);
    console.log(`Using Gemini model: ${geminiModel}`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isMessageContextMenuCommand()) {
      if (interaction.commandName !== "Ask About Message") {
        return;
      }

      const targetMessage = interaction.targetMessage;

      const modal = new ModalBuilder()
        .setCustomId(`ask-message:${interaction.id}`)
        .setTitle("Ask About Message");

      const promptInput = new TextInputBuilder()
        .setCustomId("instruction")
        .setLabel("What should I do with this message?")
        .setPlaceholder("Examples: summarize it, explain it, rewrite it politely, fact-check it")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

      const searchInput = new TextInputBuilder()
        .setCustomId("search")
        .setLabel("Use web search? (yes/no)")
        .setPlaceholder("Optional. Example: yes")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(10);

      modal.addComponents(
        new ActionRowBuilder().addComponents(promptInput),
        new ActionRowBuilder().addComponents(searchInput),
      );

      await interaction.showModal(modal);

      try {
        const modalSubmission = await interaction.awaitModalSubmit({
          filter: (submittedInteraction) =>
            submittedInteraction.customId === `ask-message:${interaction.id}` &&
            submittedInteraction.user.id === interaction.user.id,
          time: 5 * 60 * 1000,
        });

        const instruction =
          modalSubmission.fields.getTextInputValue("instruction");
        const useSearch = parseYesNo(
          modalSubmission.fields.getTextInputValue("search"),
        );

        await modalSubmission.deferReply({ flags: MessageFlags.Ephemeral });

        if (!messageHasAnalyzableContent(targetMessage)) {
          await modalSubmission.editReply(
            "That message does not contain text or attachments I can analyze yet. Try a message with text, or send the content directly with `/ask`.",
          );
          return;
        }

        const prompt = [
          "The user wants help with a Discord message.",
          `User request: ${instruction}`,
          "",
          formatMessageContext(targetMessage),
          "",
          "Respond directly to the user's request in plain text.",
          "If the message is ambiguous, say what you can infer and what remains uncertain.",
          "Quote or reference the message when helpful.",
        ].join("\n");

        const reply = await generateModelReply({
          ai,
          model: geminiModel,
          prompt,
          systemInstruction,
          maxOutputTokens: geminiMaxOutputTokens,
          thinkingBudget: geminiThinkingBudget,
          useSearch,
        });

        await sendDiscordReply(modalSubmission, reply, true);
      } catch (error) {
        if (error?.name === "InteractionCollectorError") {
          return;
        }

        console.error("Gemini message-context request failed:", error);
        console.error(`Gemini model in use: ${geminiModel}`);

        const errorSummary = describeGeminiError(error);

        try {
          await interaction.followUp({
            content:
              `Message-context request failed for \`${geminiModel}\`: ${errorSummary}`.slice(
                0,
                1900,
              ),
            flags: MessageFlags.Ephemeral,
          });
        } catch (followUpError) {
          console.error(
            "Failed to send message-context error follow-up:",
            followUpError,
          );
        }
      }

      return;
    }

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
    const useSearch = interaction.options.getBoolean("search") ?? false;

    await interaction.deferReply();

    try {
      const reply = await generateModelReply({
        ai,
        model: geminiModel,
        prompt,
        systemInstruction,
        maxOutputTokens: geminiMaxOutputTokens,
        thinkingBudget: geminiThinkingBudget,
        useSearch,
      });

      await sendDiscordReply(interaction, reply, false);
    } catch (error) {
      console.error("Gemini request failed:", error);
      console.error(`Gemini model in use: ${geminiModel}`);

      const errorSummary = describeGeminiError(error);
      const message = `Gemini request failed for \`${geminiModel}\`: ${errorSummary}`.slice(
        0,
        1900,
      );

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(message);
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
