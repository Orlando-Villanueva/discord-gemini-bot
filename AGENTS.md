# Repository Guidelines

## Project Structure & Module Organization

This is a Node.js 20+ ESM Discord bot backed by the Gemini API. Runtime behavior lives in `src/index.js`, including environment validation, Discord interaction handling, prompt construction, and Gemini responses. Keep command schemas in `src/commands.js`; both the bot and registration script consume its exported command list. Use `src/register-commands.js` only for Discord application-command registration. `render.yaml` defines the Render background worker, and `.env.example` documents required local configuration.

## Build, Test, and Development Commands

- `npm install` installs the production dependencies.
- `npm start` starts the bot once with `node src/index.js`.
- `npm run dev` starts Node watch mode for local iteration.
- `npm run register` publishes the command definitions to Discord. Set `DISCORD_GUILD_ID` to a test server so updates are fast and isolated; global registration may take time to appear.
- `node --check src/index.js` performs a quick JavaScript syntax check before a manual test.

Copy `.env.example` to `.env` before running locally. Never commit `.env`, API keys, bot tokens, or real Discord identifiers.

## Coding Style & Naming Conventions

Use two-space indentation, double quotes, semicolons, and trailing commas, matching the existing source. Prefer small named functions and early returns for interaction branches. Use `camelCase` for values and functions, `PascalCase` for imported Discord classes, and SCREAMING_SNAKE_CASE for environment-variable names. Keep user-facing errors concise, actionable, and below Discord message limits; use the existing `chunkForDiscord` helper for generated text.

## Testing Guidelines

There is no automated test suite or coverage target yet. At minimum, run `node --check` on changed source files, then validate in a dedicated Discord test guild: register commands, confirm `/ping`, exercise `/ask` with and without search, and test the **Ask About Message** modal when changing message-context behavior. Do not claim live bot or Render validation unless you observed it.

## Commit & Pull Request Guidelines

Recent commits use short, imperative subjects, such as `Add message context actions and refine Gemini handling`; follow that pattern and keep each commit focused. PRs should explain the user-visible behavior, list configuration or deployment changes, link the relevant issue when available, and include screenshots or Discord output for interaction changes. Call out any new environment variable and update `.env.example`, `README.md`, and `render.yaml` together when deployment configuration changes.
