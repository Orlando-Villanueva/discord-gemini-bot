# Minimal Discord Gemini Bot

This repo is a tiny Discord slash-command bot that uses the Google AI Studio Gemini API through the `@google/genai` SDK.

## Why this shape

- It uses slash commands instead of reading every message, so you do not need the `MESSAGE_CONTENT` privileged intent.
- It uses `gemini-2.5-flash` by default, which is Google's current quickstart model for fast text generation.
- It deploys cleanly as a long-running worker on Render.

## 1. Prerequisites

- Node.js 20+
- A Discord account with access to the [Discord Developer Portal](https://discord.com/developers/applications)
- A Google account with access to [Google AI Studio](https://aistudio.google.com/)

Note: Google's Gemini API quickstart currently says Node.js 18+, but the current `@google/genai` JavaScript SDK docs say Node.js 20+. This project pins Node 20 to stay on the safer side.

## 2. Create the Discord app

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and create a new application.
2. Open the **Bot** section and create or reveal the bot user.
3. Reset and copy the bot token. Put it in `DISCORD_TOKEN`.
4. Copy the **Application ID** from **General Information**. Put it in `DISCORD_CLIENT_ID`.
5. In **Installation** or **OAuth2**, make sure the install link includes:
   - `bot`
   - `applications.commands`
6. Install the app to a test server you control.
7. Grant at least the ability to send messages in that server.

Recommendation: keep a test server just for development, then set `DISCORD_GUILD_ID` to that server ID. Guild-scoped commands update immediately, which is much nicer while iterating.

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

- `GEMINI_MODEL` defaults to `gemini-2.5-flash`
- `GEMINI_MAX_OUTPUT_TOKENS` defaults to `512`
- `GEMINI_THINKING_BUDGET` defaults to `0` for faster, cheaper replies
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
- `/ask prompt: Summarize this in one paragraph private: true`
- `/ask prompt: What changed in OpenAI this week? search: true`

When `search: true` is enabled, the bot tells Gemini to use Google Search grounding so it can answer with fresher web-backed information and include source links in the response.

## 7. Deploy to Render

This repo includes [render.yaml](/Users/orlando/Projects/Agents/discord-bot/render.yaml), so Render can create the worker from the repository settings.

1. Push this repo to GitHub.
2. In Render, create a new Blueprint from the repository.
3. Render will read `render.yaml` and create a background worker.
4. Enter secret values for:
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `GEMINI_API_KEY`
5. Optionally set `DISCORD_GUILD_ID` in the Render dashboard if you want test-server command registration during deploys.
6. Deploy.

Render runs `npm run register` as a pre-deploy step, then starts the bot with `npm start`.

## 8. File map

- [src/index.js](/Users/orlando/Projects/Agents/discord-bot/src/index.js): Discord client and Gemini call
- [src/register-commands.js](/Users/orlando/Projects/Agents/discord-bot/src/register-commands.js): slash command registration
- [src/commands.js](/Users/orlando/Projects/Agents/discord-bot/src/commands.js): command definitions
- [render.yaml](/Users/orlando/Projects/Agents/discord-bot/render.yaml): Render worker setup
- [.env.example](/Users/orlando/Projects/Agents/discord-bot/.env.example): required environment variables

## 9. Recommended next improvements

- Add per-channel or per-user conversation memory
- Add moderation or allowlists before exposing the bot broadly
- Log prompts and failures to a dashboard or error tracker
- Add rate limiting so one user cannot spam the model

## Official references

- Google Gemini API quickstart: [ai.google.dev/gemini-api/docs/quickstart](https://ai.google.dev/gemini-api/docs/quickstart)
- Google Search grounding: [ai.google.dev/gemini-api/docs/google-search](https://ai.google.dev/gemini-api/docs/google-search)
- Google API key guide: [ai.google.dev/gemini-api/docs/api-key](https://ai.google.dev/gemini-api/docs/api-key)
- Google text generation guide: [ai.google.dev/gemini-api/docs/text-generation](https://ai.google.dev/gemini-api/docs/text-generation)
- Google JS SDK docs: [googleapis.github.io/js-genai](https://googleapis.github.io/js-genai/)
- Discord getting started guide: [docs.discord.com/developers/quick-start/getting-started](https://docs.discord.com/developers/quick-start/getting-started)
- Discord application commands: [docs.discord.com/developers/interactions/application-commands](https://docs.discord.com/developers/interactions/application-commands)
- Discord gateway intents: [docs.discord.com/developers/events/gateway](https://docs.discord.com/developers/events/gateway)
- Render background workers: [render.com/docs/background-workers](https://render.com/docs/background-workers)
- Render blueprint spec: [render.com/docs/blueprint-spec](https://render.com/docs/blueprint-spec)
