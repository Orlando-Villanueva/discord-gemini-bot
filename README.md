# Discord Gemini Bot

A minimal, self-hosted Discord assistant powered by the Google AI Studio Gemini API. It offers slash commands, an **Ask About Message** context action, and optional Google Search grounding.

This is a developer-first template, not a hosted service: you create and control your own Discord application, provide and pay for your own Gemini API key, and run the bot on your own machine or Node-compatible host.

## Features

- Slash-command-first interaction, so the bot does not require Discord's `MESSAGE_CONTENT` privileged intent.
- `/ask` with optional Google Search grounding for web-backed responses.
- **Ask About Message**, a message-context action that lets a user choose the exact message they want Gemini to analyze.
- Self-identifying answers with a compact Gemini-generated subject heading (and, for message actions, a compact message preview) above the model response.
- Environment-based configuration for the model, output limit, reasoning level, system instruction, and emoji style.

## 1. Prerequisites

- Node.js 20+
- A Discord account with access to the [Discord Developer Portal](https://discord.com/developers/applications)
- A Google account with access to [Google AI Studio](https://aistudio.google.com/)

Note: Google's Gemini API quickstart currently says Node.js 18+, but the current `@google/genai` JavaScript SDK docs say Node.js 20+. This project pins Node 20 to stay on the safer side.

## 2. Create and install your Discord bot

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and create a new application.
2. Open the **Bot** section and create or reveal the bot user.
3. Reset and copy the bot token. Put it in `DISCORD_TOKEN`.
4. Copy the **Application ID** from **General Information**. Put it in `DISCORD_CLIENT_ID`.
5. Open **Installation** and enable **Guild Install**.
6. In the Guild Install settings, add these scopes:
   - `bot`
   - `applications.commands`
7. Request only the **Send Messages** bot permission.
8. Copy Discord's generated install link, open it, and install the app in a server you manage.

Recommendation: keep a test server just for development, then set `DISCORD_GUILD_ID` to that server ID. Guild-scoped commands update immediately, which is much nicer while iterating.

Need a walkthrough of the Discord portal? See Discord's official [Build your first bot guide](https://docs.discord.com/developers/quick-start/getting-started).

## 3. Create the Google AI Studio API key

1. Open [Google AI Studio](https://aistudio.google.com/).
2. Create an API key.
3. Put it in `GEMINI_API_KEY`.

## 4. Configure the project

```bash
cp .env.example .env
npm install
```

Then fill in `.env`:

```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_application_id
DISCORD_GUILD_ID=your_test_server_id
GEMINI_API_KEY=your_google_ai_studio_key
```

Optional knobs:

- `GEMINI_MODEL` defaults to `gemini-3.8-flash`, the latest generally available Gemini Flash model.
- `GEMINI_MAX_OUTPUT_TOKENS` defaults to `4096`, leaving room for Gemini's reasoning tokens before the visible answer.
- `GEMINI_THINKING_LEVEL` defaults to `medium` for a balance of quality and latency. Use `low` for faster replies or `high` when a task needs deeper reasoning.
- `DISCORD_EMOJI_STYLE` defaults to `light`, which allows occasional restrained emoji use; set it to `off` to keep replies emoji-free
- `SYSTEM_INSTRUCTION` lets you control the bot persona

## 5. Register the slash commands

```bash
npm run register
```

If `DISCORD_GUILD_ID` is set, commands register only in that server and appear quickly. If it is blank, commands register globally and can take longer to show up.

## 6. Run locally

```bash
npm start
```

You should see a login message in the terminal. Then test these commands in Discord:

- `/ping`
- `/ask prompt: Explain vector databases in simple terms`
- `/ask prompt: What changed in OpenAI this week? search: true`
- Right-click a message -> `Apps` -> `Ask About Message`

When `search: true` is enabled, the bot tells Gemini to use Google Search grounding so it can answer with fresher web-backed information and include source links in the response.

The `Ask About Message` context-menu command lets you target a specific Discord message and then type your own instruction, such as "summarize this", "rewrite this politely", or "fact-check this". This gives the bot message-level context without requiring full channel-reading memory.

Every substantive answer asks Gemini for a concise 3–8 word subject heading, then shows that heading above the response so the topic remains clear even when Discord collapses the slash-command arguments. If Gemini does not return the requested subject marker, the bot falls back to a shortened version of the query. Public `/ask` replies show the generated subject in the channel; private `Ask About Message` replies also show the target author and a short message preview.

If you want the lowest-cost Gemini 3 option instead, set `GEMINI_MODEL=gemini-3.5-flash-lite` in your local `.env`. Set `GEMINI_THINKING_LEVEL=low` for fast, inexpensive replies.

## 7. Run it somewhere else

The bot is an ordinary long-running Node.js process. On a Node-compatible host, configure the same environment variables and run these commands:

```bash
npm install
npm run register
npm start
```

The host must keep the process running and be able to make outbound connections to Discord and the Gemini API. Do not put your Discord token or Gemini API key in source control.

## Privacy and cost

- This project does not include, collect, or operate with anyone else's credentials.
- Prompts sent to a deployed bot are processed by its owner's configured Gemini account, subject to Google's terms and data practices.
- Public `/ask` replies include a shortened copy of the question, so avoid putting sensitive information in a public command unless that visibility is intended.
- The owner of each deployment is responsible for Gemini usage, quotas, billing, server access, and any moderation or rate limiting appropriate for their community.

## File map

- `src/index.js`: Discord client and Gemini call
- `src/register-commands.js`: slash-command registration
- `src/commands.js`: command definitions
- `.env.example`: required configuration

## Contributing

Issues and pull requests are welcome. Please do not include tokens, API keys, or Discord IDs in issues, commits, or screenshots.

## Official references

- Google Gemini API quickstart: [ai.google.dev/gemini-api/docs/quickstart](https://ai.google.dev/gemini-api/docs/quickstart)
- Google Search grounding: [ai.google.dev/gemini-api/docs/google-search](https://ai.google.dev/gemini-api/docs/google-search)
- Google API key guide: [ai.google.dev/gemini-api/docs/api-key](https://ai.google.dev/gemini-api/docs/api-key)
- Google text generation guide: [ai.google.dev/gemini-api/docs/text-generation](https://ai.google.dev/gemini-api/docs/text-generation)
- Google JS SDK docs: [googleapis.github.io/js-genai](https://googleapis.github.io/js-genai/)
- Discord getting started guide: [docs.discord.com/developers/quick-start/getting-started](https://docs.discord.com/developers/quick-start/getting-started)
- Discord application commands: [docs.discord.com/developers/interactions/application-commands](https://docs.discord.com/developers/interactions/application-commands)
- Discord gateway intents: [docs.discord.com/developers/events/gateway](https://docs.discord.com/developers/events/gateway)
