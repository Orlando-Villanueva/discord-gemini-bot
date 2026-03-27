import { SlashCommandBuilder } from "discord.js";

export const commandBuilders = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check whether the bot is online."),
  new SlashCommandBuilder()
    .setName("ask")
    .setDescription("Ask Gemini a question.")
    .addStringOption((option) =>
      option
        .setName("prompt")
        .setDescription("What you want the bot to answer.")
        .setRequired(true),
    )
    .addBooleanOption((option) =>
      option
        .setName("private")
        .setDescription("If true, only you can see the reply."),
    ),
];

export const commands = commandBuilders.map((command) => command.toJSON());
