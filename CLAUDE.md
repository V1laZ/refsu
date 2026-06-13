# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Refsu is a cross-platform (desktop + Android) IRC client for osu! tournament referees, built with Tauri 2 (Rust backend) + Vue 3 / TypeScript / Tailwind v4 frontend. It connects to osu!'s IRC server (`irc.ppy.sh:6667`) and overlays referee-specific UI (mappools, lobby state tracking, quick `!mp` commands) on top of plain IRC.

## Commands

Package manager is **pnpm** (pinned to 10.0.0 in `package.json`).

```bash
pnpm install                # install deps (also requires Rust toolchain)
pnpm tauri dev              # run full app (spawns vite on :1420, then Rust window)
pnpm dev                    # frontend-only (no Tauri window — most things won't work)
pnpm build                  # vue-tsc typecheck + vite build (frontend bundle only)
pnpm tauri build            # production desktop bundle
pnpm tauri android dev      # Android dev (requires `pnpm tauri android init` once)
pnpm tauri android build    # Android APK
pnpm lint                   # eslint check
pnpm lint:fix               # eslint --fix (same as `pnpm format`)
```

There is **no test suite**.

## Architecture

### Two-process split

The IRC connection lives entirely in Rust (`src-tauri/src/`). The frontend never speaks IRC directly — it invokes Tauri commands and listens to events. Treat the Rust state as the source of truth.

- **Tauri commands** (frontend → backend, registered in `src-tauri/src/lib.rs`): `connect_to_bancho`, `send_message_to_room`, `join_channel`, `set_mappool`, `fetch_beatmap_data`, `get_rooms_list`, `get_room_state`, `get_room_messages_page`, etc. Add new commands in `commands.rs` AND the `invoke_handler!` macro in `lib.rs`.
- **Tauri events** (backend → frontend): `rooms-list-updated`, `active-room-message`, `inactive-room-unread-updated`, `oauth-token-callback`. The frontend subscribes via `@tauri-apps/api/event`.
- Shared global IRC state is `IrcState = Arc<Mutex<IrcClientState>>` in `types.rs`, registered with `.manage()` in `lib.rs`.

### Rust modules

- `irc_handler.rs` — async loop owning the IRC client; runs in a `tokio::spawn` from `connect_to_bancho`. Reads incoming messages from the stream and outgoing commands from an `mpsc::UnboundedReceiver<IrcCommand>`. The `message_sender` half is stashed in `IrcClientState` so commands can push work into the loop.
- `banchobot_parser.rs` — parses BanchoBot's status messages (`!mp settings`, slot lists, host changes, match start/finish, beatmap changes) and mutates `LobbyState`. **All multiplayer lobby state derives from parsing BanchoBot output**, not from a structured API.
- `osu_api.rs` — calls the osu! v2 REST API for beatmap/user metadata, using OAuth tokens stored client-side.
- `migrations.rs` — SQLite schema migrations consumed by `tauri-plugin-sql`. Add new migrations as additional entries; never edit historical ones.
- `commands.rs` — thin wrappers that translate Tauri command arguments into IRC operations or state reads.

### Room model

Rooms are keyed by their IRC id (`#channel`, `#mp_12345`, or a PM username). `Room::new_channel` auto-detects multiplayer lobbies by the `#mp_` prefix and attaches a `LobbyState` to them; regular channels and PMs do not have lobby state. Messages are stored in-memory in `Room.messages` (not persisted) and exposed to the frontend in paginated chunks via `get_room_messages_page` (page size 20, see `MESSAGE_PAGE_SIZE`). `RoomListItem` is the lightweight projection sent in `rooms-list-updated` to avoid shipping all messages on every update.

### Frontend

- Vue 3 + Composition API, Vue Router with `createWebHashHistory` (two routes: `/login`, `/`).
- State management: a plain `reactive()` object in `src/stores/global.ts` — no Pinia. Connection/user info lives there; per-room state comes from Tauri.
- Path alias `@/*` → `src/*` (configured in both `vite.config.ts` and `tsconfig.json`).
- Tailwind v4 via `@tailwindcss/vite` (no `tailwind.config.js` — config is CSS-side in `src/assets/css/main.css`).
- The custom title bar (`UI/TitleBar.vue`) exists because `tauri.conf.json` sets `decorations: false`.

### Persistence

SQLite via `tauri-plugin-sql`, file `refsu_database.db`. Tables: `user_credentials` (IRC login), `mappools` + `beatmap_entries` (tournament mappools), `oauth_tokens` (osu! API OAuth, keyed by `irc_username`). All DB calls go through `src/services/database.ts` (singleton `dbService`). Token refresh hits `https://refsu.vilaz.dev/refresh-token` and clears the row on failure.

### OAuth

osu! OAuth uses a deep link (`refsu://` on desktop, `refsu.vilaz.dev/callback` on Android). The handler in `lib.rs` (`app.deep_link().on_open_url`) base64-decodes the `data` query param into `{access_token, refresh_token, expires_in}` and emits `oauth-token-callback` to the frontend, which writes it to `oauth_tokens` via `dbService.saveOAuthToken`.

## Conventions

- **No semicolons** in TS/JS (`.vscode/settings.json` strips them; ESLint stylistic plugin enforces it).
- **2-space indent**, ESLint flat config in `eslint.config.ts` (vue/recommended + ts-eslint + @stylistic). Run `pnpm lint:fix` before committing.
- **Non-relative imports preferred** (`@/components/...`, not `../../components/...`).
- `vue/multi-word-component-names` is disabled.
- `noUnusedLocals` / `noUnusedParameters` are enforced by tsconfig — `pnpm build` will fail on dead variables.
- `tauri.conf.json` `version` and `package.json` `version` are kept in sync (bump both for releases).
- When changing Rust types shared with the frontend, remember `#[serde(rename_all = "camelCase")]` is the default — TypeScript sees `roomType`, not `room_type`.
