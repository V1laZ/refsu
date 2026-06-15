use crate::types::*;
use regex::Regex;
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Emitter;

/// Compiles a regex pattern once and reuses it for all subsequent calls.
macro_rules! static_regex {
    ($pattern:expr) => {{
        static RE: OnceLock<Regex> = OnceLock::new();
        RE.get_or_init(|| Regex::new($pattern).expect("Invalid regex pattern"))
    }};
}

pub struct BanchoBotParser;

impl BanchoBotParser {
    fn emit_lobby_update(
        channel: &str,
        lobby: &LobbyState,
        active_room_id: Option<&str>,
        app_handle: &tauri::AppHandle,
    ) {
        let is_active = active_room_id == Some(channel);

        if is_active {
            let _ = app_handle.emit(
                "active-room-lobby-state-updated",
                serde_json::json!({ "lobbyState": lobby }),
            );
        }
    }

    pub fn parse_irc_message(
        message: &IrcMessage,
        state: &IrcState,
        app_handle: &tauri::AppHandle,
    ) -> bool {
        if message.username != "BanchoBot" {
            // Handle user leaving lobby
            if let Some(captures) =
                static_regex!(r"^(.+) left (#mp_\d+)$").captures(&message.message)
            {
                let username = captures.get(1).unwrap().as_str();
                let channel = captures.get(2).unwrap().as_str();
                Self::remove_player_by_username(username, channel, state, app_handle);
                return true;
            }
            return false;
        }

        Self::parse_banchobot_message(message, state, app_handle)
    }

    fn parse_banchobot_message(
        message: &IrcMessage,
        state: &IrcState,
        app_handle: &tauri::AppHandle,
    ) -> bool {
        if message.username != "BanchoBot" {
            return false;
        }

        let text = &message.message;
        let channel = &message.room_id;

        if !channel.starts_with("#mp_") {
            return false;
        }

        // Room name pattern
        if let Some(captures) =
            static_regex!(r"^Room name: (.+), History: https://osu\.ppy\.sh/mp/(\d+)$")
                .captures(text)
        {
            let room_name = captures.get(1).unwrap().as_str();
            Self::update_lobby_settings(
                channel,
                |settings| {
                    settings.room_name = room_name.to_string();
                },
                state,
                app_handle,
            );
            return true;
        }

        // Team mode and win condition
        if let Some(captures) =
            static_regex!(r"^Team mode: (.+), Win condition: (.+)$").captures(text)
        {
            let team_mode = match captures.get(1).unwrap().as_str() {
                "Head To Head" | "HeadToHead" => "HeadToHead",
                "Tag Coop" | "TagCoop" => "TagCoop",
                "Team Vs" | "TeamVs" => "TeamVs",
                "Tag Team Vs" | "TagTeamVs" => "TagTeamVs",
                _ => "HeadToHead",
            };

            let win_condition = match captures.get(2).unwrap().as_str() {
                "Score" => "Score",
                "Accuracy" => "Accuracy",
                "Combo" => "Combo",
                "Score V2" | "ScoreV2" => "ScoreV2",
                _ => "Score",
            };

            Self::update_lobby_settings(
                channel,
                |settings| {
                    settings.team_mode = team_mode.to_string();
                    settings.win_condition = win_condition.to_string();
                },
                state,
                app_handle,
            );
            return true;
        }

        // Slot info
        if let Some(captures) = static_regex!(r"^Slot (\d+)\s+(.+)$").captures(text) {
            if let Ok(slot_id) = captures.get(1).unwrap().as_str().parse::<u8>() {
                let slot_info = captures.get(2).unwrap().as_str();
                Self::parse_slot_info(slot_info, slot_id, channel, state, app_handle);
                return true;
            }
        }

        // Current beatmap (from !mp settings)
        if let Some(captures) =
            static_regex!(r"^Beatmap: https://osu\.ppy\.sh/b/(\d+) (.+) \[(.+)\]$").captures(text)
        {
            if let Ok(beatmap_id) = captures.get(1).unwrap().as_str().parse::<u64>() {
                let full_title = captures.get(2).unwrap().as_str();
                let difficulty = captures.get(3).unwrap().as_str();

                if let Some(title_captures) = static_regex!(r"^(.+) - (.+)$").captures(full_title) {
                    let artist = title_captures.get(1).unwrap().as_str();
                    let title = title_captures.get(2).unwrap().as_str();

                    Self::update_current_map(
                        channel,
                        CurrentMap {
                            beatmap_id,
                            artist: artist.to_string(),
                            title: title.to_string(),
                            difficulty: difficulty.to_string(),
                        },
                        state,
                        app_handle,
                    );
                }
                return true;
            }
        }

        // Changed beatmap to (from !mp map {map_id})
        if let Some(captures) =
            static_regex!(r"^Changed beatmap to https://osu\.ppy\.sh/b/(\d+) (.+) - (.+)$")
                .captures(text)
        {
            if let Ok(beatmap_id) = captures.get(1).unwrap().as_str().parse::<u64>() {
                Self::update_current_map(
                    channel,
                    CurrentMap {
                        beatmap_id,
                        artist: captures.get(2).unwrap().as_str().to_string(),
                        title: captures.get(3).unwrap().as_str().to_string(),
                        difficulty: String::new(),
                    },
                    state,
                    app_handle,
                );
                return true;
            }
        }

        // Current beatmap without difficulty bracket (from !mp map {map_id})
        if let Some(captures) =
            static_regex!(r"^Beatmap: https://osu\.ppy\.sh/b/(\d+) (.+) - (.+)$").captures(text)
        {
            if let Ok(beatmap_id) = captures.get(1).unwrap().as_str().parse::<u64>() {
                Self::update_current_map(
                    channel,
                    CurrentMap {
                        beatmap_id,
                        artist: captures.get(2).unwrap().as_str().to_string(),
                        title: captures.get(3).unwrap().as_str().to_string(),
                        difficulty: String::new(),
                    },
                    state,
                    app_handle,
                );
                return true;
            }
        }

        // Active mods
        if let Some(captures) = static_regex!(r"^Active mods: (.+)$").captures(text) {
            let mods_str = captures.get(1).unwrap().as_str();
            let mut mods: Vec<String> = mods_str
                .split(", ")
                .map(|m| Self::normalize_mod_name(m))
                .collect();

            let mut freemod = false;
            mods.retain(|m| {
                if m == "Freemod" {
                    freemod = true;
                    false
                } else {
                    true
                }
            });

            Self::update_mods(channel, mods, freemod, state, app_handle);
            return true;
        }

        // Beatmap changed (manually by user in lobby)
        if let Some(captures) = static_regex!(
            r"^Beatmap changed to: (.+) - (.+) \[(.+)\] \(https://osu\.ppy\.sh/b/(\d+)\)$"
        )
        .captures(text)
        {
            if let Ok(beatmap_id) = captures.get(4).unwrap().as_str().parse::<u64>() {
                Self::update_current_map(
                    channel,
                    CurrentMap {
                        beatmap_id,
                        artist: captures.get(1).unwrap().as_str().to_string(),
                        title: captures.get(2).unwrap().as_str().to_string(),
                        difficulty: captures.get(3).unwrap().as_str().to_string(),
                    },
                    state,
                    app_handle,
                );
                return true;
            }
        }

        // Player joined
        if let Some(captures) =
            static_regex!(r"^(.+) joined in slot (\d+)( for team (red|blue))?\.?$").captures(text)
        {
            if let Ok(slot_id) = captures.get(2).unwrap().as_str().parse::<u8>() {
                let team = captures.get(4).map(|m| m.as_str().to_string());

                Self::add_player(
                    channel,
                    slot_id,
                    Player {
                        username: captures.get(1).unwrap().as_str().to_string(),
                        team,
                        is_ready: false,
                        is_playing: false,
                        is_host: false,
                    },
                    state,
                    app_handle,
                );
                return true;
            }
        }

        // Player left
        if let Some(captures) = static_regex!(r"^(.+) left the game\.?$").captures(text) {
            Self::remove_player_by_username(
                captures.get(1).unwrap().as_str(),
                channel,
                state,
                app_handle,
            );
            return true;
        }

        // Match status changes
        if text == "All players are ready" {
            Self::update_match_status(channel, "ready", state, app_handle);
            return true;
        }

        if text == "The match has started!" {
            Self::update_match_status(channel, "active", state, app_handle);
            return true;
        }

        if text == "Cleared match host" {
            Self::clear_host(channel, state, app_handle);
            return true;
        }

        // Host changed
        if let Some(captures) = static_regex!(r"^Changed match host to (.+)$").captures(text) {
            Self::update_host(
                channel,
                captures.get(1).unwrap().as_str(),
                state,
                app_handle,
            );
            return true;
        }

        // Player moved to different slot
        if let Some(captures) = static_regex!(r"^(.+) moved to slot (\d+)$").captures(text) {
            if let Ok(new_slot_id) = captures.get(2).unwrap().as_str().parse::<u8>() {
                Self::move_player_to_slot(
                    channel,
                    captures.get(1).unwrap().as_str(),
                    new_slot_id,
                    None,
                    state,
                    app_handle,
                );
                return true;
            }
        }

        // Match aborted or finished
        if text == "The match was aborted" || text.contains("Aborted the match") {
            Self::update_match_status(channel, "idle", state, app_handle);
            return true;
        }

        if text.contains("finished playing") || text.contains("The match has finished!") {
            Self::update_match_status(channel, "idle", state, app_handle);
            return true;
        }

        // Room name updated
        if let Some(captures) = static_regex!(r#"^Room name updated to "(.+)"$"#).captures(text) {
            let room_name = captures.get(1).unwrap().as_str().to_string();
            Self::update_lobby_settings(
                channel,
                |settings| {
                    settings.room_name = room_name.clone();
                },
                state,
                app_handle,
            );
            return true;
        }

        if let Some(captures) =
            static_regex!(r"^Changed match settings to (.+)$").captures(text)
        {
            let settings_str = captures.get(1).unwrap().as_str();

            let mut new_team_mode: Option<&str> = None;
            let mut new_win_condition: Option<&str> = None;
            let mut new_size: Option<u8> = None;

            for token in settings_str.split(", ") {
                match token {
                    "HeadToHead" | "TagCoop" | "TeamVs" | "TagTeamVs" => {
                        new_team_mode = Some(token);
                    }
                    "Score" | "Accuracy" | "Combo" | "ScoreV2" => {
                        new_win_condition = Some(token);
                    }
                    _ => {
                        if let Some(size_caps) = static_regex!(r"^(\d+) slots$").captures(token) {
                            if let Ok(size) = size_caps.get(1).unwrap().as_str().parse::<u8>() {
                                new_size = Some(size);
                            }
                        }
                    }
                }
            }

            Self::update_lobby_settings(
                channel,
                |settings| {
                    if let Some(team_mode) = new_team_mode {
                        settings.team_mode = team_mode.to_string();
                    }
                    if let Some(win_condition) = new_win_condition {
                        settings.win_condition = win_condition.to_string();
                    }
                    if let Some(size) = new_size {
                        settings.size = size;
                    }
                },
                state,
                app_handle,
            );
            return true;
        }

        // Mods changed (freemod disabled)
        if let Some(captures) = static_regex!(r"^Enabled (.+), disabled FreeMod$").captures(text) {
            let mods = captures
                .get(1)
                .unwrap()
                .as_str()
                .split(", ")
                .map(|m| Self::normalize_mod_name(m))
                .collect();
            Self::update_mods(channel, mods, false, state, app_handle);
            return true;
        }

        // Player changed team
        if let Some(captures) = static_regex!(r#"^(.+) changed to (Red|Blue)$"#).captures(text) {
            let username = captures.get(1).unwrap().as_str();
            let team = captures.get(2).unwrap().as_str().to_lowercase();
            let mut irc_state = state.lock().unwrap();
            let active_room_id = irc_state.active_room_id.clone();
            if let Some(room) = irc_state.rooms.get_mut(channel.as_str()) {
                if let Some(lobby) = &mut room.lobby_state {
                    for slot in &mut lobby.slots {
                        if let Some(ref mut player) = slot.player {
                            if player.username == username {
                                player.team = Some(team.clone());
                            }
                        }
                    }
                    Self::emit_lobby_update(channel, lobby, active_room_id.as_deref(), app_handle);
                }
            }
            return true;
        }

        if text == "Disabled all mods, enabled FreeMod" {
            Self::update_mods(channel, Vec::new(), true, state, app_handle);
            return true;
        }

        if text == "Disabled all mods, disabled FreeMod" {
            Self::update_mods(channel, Vec::new(), false, state, app_handle);
            return true;
        }

        // Countdown with only seconds
        if let Some(captures) = static_regex!(r"^Countdown ends in (\d+) seconds$").captures(text) {
            if let Ok(duration) = captures.get(1).unwrap().as_str().parse::<u32>() {
                Self::update_timer(channel, Some(duration), state, app_handle);
                return true;
            }
        }

        // Countdown with minutes and seconds
        if let Some(captures) =
            static_regex!(r"^Countdown ends in (\d+) minutes? and (\d+) seconds$").captures(text)
        {
            let mins = captures.get(1).unwrap().as_str().parse::<u32>();
            let secs = captures.get(2).unwrap().as_str().parse::<u32>();
            if let (Ok(m), Ok(s)) = (mins, secs) {
                Self::update_timer(channel, Some(m * 60 + s), state, app_handle);
                return true;
            }
        }

        // Countdown finished or aborted
        if text == "Countdown finished" || text == "Countdown aborted" {
            Self::update_timer(channel, None, state, app_handle);
            return true;
        }

        false
    }

    fn parse_slot_info(
        slot_text: &str,
        slot_id: u8,
        channel: &str,
        state: &IrcState,
        app_handle: &tauri::AppHandle,
    ) {
        let is_ready = !slot_text.contains("Not Ready") && !slot_text.contains("No Map");

        if let Some(captures) =
            static_regex!(r"https?://osu\.ppy\.sh/u/\d+\s+([^\s\[]+)").captures(slot_text)
        {
            let username = captures.get(1).unwrap().as_str().trim();
            if !username.is_empty() {
                let team = if slot_text.contains("Team Blue") {
                    Some("blue".to_string())
                } else if slot_text.contains("Team Red") {
                    Some("red".to_string())
                } else {
                    None
                };

                Self::add_player(
                    channel,
                    slot_id,
                    Player {
                        username: username.to_string(),
                        team,
                        is_ready,
                        is_playing: false,
                        is_host: slot_text.contains("[Host"),
                    },
                    state,
                    app_handle,
                );
            }
        }
    }

    fn update_lobby_settings<F>(
        channel: &str,
        updater: F,
        state: &IrcState,
        app_handle: &tauri::AppHandle,
    ) where
        F: FnOnce(&mut LobbySettings),
    {
        let mut irc_state = state.lock().unwrap();
        let active_room_id = irc_state.active_room_id.clone();
        if let Some(room) = irc_state.rooms.get_mut(channel) {
            if let Some(lobby) = &mut room.lobby_state {
                if lobby.settings.is_none() {
                    lobby.settings = Some(LobbySettings {
                        room_name: String::new(),
                        team_mode: "HeadToHead".to_string(),
                        win_condition: "Score".to_string(),
                        size: 16,
                        password: None,
                    });
                }

                if let Some(ref mut settings) = lobby.settings {
                    updater(settings);
                }

                Self::emit_lobby_update(channel, lobby, active_room_id.as_deref(), app_handle);
            }
        }
    }

    fn update_current_map(
        channel: &str,
        map: CurrentMap,
        state: &IrcState,
        app_handle: &tauri::AppHandle,
    ) {
        let mut irc_state = state.lock().unwrap();
        let active_room_id = irc_state.active_room_id.clone();
        if let Some(room) = irc_state.rooms.get_mut(channel) {
            if let Some(lobby) = &mut room.lobby_state {
                lobby.current_map = Some(map);
                Self::emit_lobby_update(channel, lobby, active_room_id.as_deref(), app_handle);
            }
        }
    }

    fn add_player(
        channel: &str,
        slot_id: u8,
        player: Player,
        state: &IrcState,
        app_handle: &tauri::AppHandle,
    ) {
        let mut irc_state = state.lock().unwrap();
        let active_room_id = irc_state.active_room_id.clone();
        if let Some(room) = irc_state.rooms.get_mut(channel) {
            if let Some(lobby) = &mut room.lobby_state {
                if let Some(slot) = lobby.slots.iter_mut().find(|s| s.id == slot_id) {
                    slot.player = Some(player);
                    Self::emit_lobby_update(channel, lobby, active_room_id.as_deref(), app_handle);
                }
            }
        }
    }

    fn remove_player_by_username(
        username: &str,
        channel: &str,
        state: &IrcState,
        app_handle: &tauri::AppHandle,
    ) {
        let mut irc_state = state.lock().unwrap();
        let active_room_id = irc_state.active_room_id.clone();
        if let Some(room) = irc_state.rooms.get_mut(channel) {
            if let Some(lobby) = &mut room.lobby_state {
                for slot in &mut lobby.slots {
                    if let Some(ref player) = slot.player {
                        if player.username == username {
                            slot.player = None;
                            break;
                        }
                    }
                }
                Self::emit_lobby_update(channel, lobby, active_room_id.as_deref(), app_handle);
            }
        }
    }

    fn update_match_status(
        channel: &str,
        status: &str,
        state: &IrcState,
        app_handle: &tauri::AppHandle,
    ) {
        let mut irc_state = state.lock().unwrap();
        let active_room_id = irc_state.active_room_id.clone();
        if let Some(room) = irc_state.rooms.get_mut(channel) {
            if let Some(lobby) = &mut room.lobby_state {
                let previous = lobby.match_status.clone();
                lobby.match_status = status.to_string();

                match status {
                    "active" => {
                        lobby.match_start_time = Some(
                            SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs(),
                        );
                    }
                    "idle" => {
                        lobby.match_start_time = None;
                        for slot in &mut lobby.slots {
                            if let Some(ref mut player) = slot.player {
                                player.is_ready = false;
                            }
                        }
                    }
                    "ready" => {
                        for slot in &mut lobby.slots {
                            if let Some(ref mut player) = slot.player {
                                player.is_ready = true;
                            }
                        }
                    }
                    _ => {}
                }

                Self::emit_lobby_update(channel, lobby, active_room_id.as_deref(), app_handle);

                if previous != status {
                    let _ = app_handle.emit(
                        "room-match-status-updated",
                        serde_json::json!({
                            "roomId": channel,
                            "matchStatus": status,
                        }),
                    );
                }

                let sound = match (previous.as_str(), status) {
                    (prev, "ready") if prev != "ready" => Some(SoundNotificationKind::AllReady),
                    (prev, "active") if prev != "active" => Some(SoundNotificationKind::MatchStart),
                    ("active", "idle") => Some(SoundNotificationKind::MatchFinish),
                    _ => None,
                };
                if let Some(kind) = sound {
                    emit_sound_notification(app_handle, kind, channel);
                }
            }
        }
    }

    fn clear_host(channel: &str, state: &IrcState, app_handle: &tauri::AppHandle) {
        let mut irc_state = state.lock().unwrap();
        let active_room_id = irc_state.active_room_id.clone();
        if let Some(room) = irc_state.rooms.get_mut(channel) {
            if let Some(lobby) = &mut room.lobby_state {
                lobby.host = None;

                for slot in &mut lobby.slots {
                    if let Some(ref mut player) = slot.player {
                        player.is_host = false;
                    }
                }

                Self::emit_lobby_update(channel, lobby, active_room_id.as_deref(), app_handle);
            }
        }
    }

    fn update_host(
        channel: &str,
        host_username: &str,
        state: &IrcState,
        app_handle: &tauri::AppHandle,
    ) {
        let mut irc_state = state.lock().unwrap();
        let active_room_id = irc_state.active_room_id.clone();
        if let Some(room) = irc_state.rooms.get_mut(channel) {
            if let Some(lobby) = &mut room.lobby_state {
                lobby.host = Some(host_username.to_string());

                for slot in &mut lobby.slots {
                    if let Some(ref mut player) = slot.player {
                        player.is_host = player.username == host_username;
                    }
                }

                Self::emit_lobby_update(channel, lobby, active_room_id.as_deref(), app_handle);
            }
        }
    }

    fn move_player_to_slot(
        channel: &str,
        username: &str,
        new_slot_id: u8,
        team: Option<String>,
        state: &IrcState,
        app_handle: &tauri::AppHandle,
    ) {
        let mut irc_state = state.lock().unwrap();
        let active_room_id = irc_state.active_room_id.clone();
        if let Some(room) = irc_state.rooms.get_mut(channel) {
            if let Some(lobby) = &mut room.lobby_state {
                let mut player_data = None;
                for slot in &mut lobby.slots {
                    if let Some(ref player) = slot.player {
                        if player.username == username {
                            player_data = slot.player.take();
                            break;
                        }
                    }
                }

                if let Some(mut player) = player_data {
                    if let Some(team) = team {
                        player.team = Some(team);
                    }

                    if let Some(slot) = lobby.slots.iter_mut().find(|s| s.id == new_slot_id) {
                        slot.player = Some(player);
                    }
                }

                Self::emit_lobby_update(channel, lobby, active_room_id.as_deref(), app_handle);
            }
        }
    }

    fn normalize_mod_name(mod_name: &str) -> String {
        match mod_name {
            "Hidden" => "HD",
            "HardRock" => "HR",
            "DoubleTime" => "DT",
            "Flashlight" => "FL",
            "NoFail" => "NF",
            "Easy" => "EZ",
            "HalfTime" => "HT",
            "SuddenDeath" => "SD",
            "Perfect" => "PF",
            "Relax" => "RX",
            "Nightcore" => "NC",
            "SpunOut" => "SO",
            other => return other.to_string(),
        }
        .to_string()
    }

    fn update_mods(
        channel: &str,
        mods: Vec<String>,
        freemod: bool,
        state: &IrcState,
        app_handle: &tauri::AppHandle,
    ) {
        let mut irc_state = state.lock().unwrap();
        let active_room_id = irc_state.active_room_id.clone();
        if let Some(room) = irc_state.rooms.get_mut(channel) {
            if let Some(lobby) = &mut room.lobby_state {
                lobby.selected_mods = mods;
                lobby.freemod = freemod;
                Self::emit_lobby_update(channel, lobby, active_room_id.as_deref(), app_handle);
            }
        }
    }

    /// Sets or clears the lobby countdown timer.
    /// Pass `Some(duration_secs)` to start, `None` to clear.
    fn update_timer(
        channel: &str,
        duration: Option<u32>,
        state: &IrcState,
        app_handle: &tauri::AppHandle,
    ) {
        let mut irc_state = state.lock().unwrap();
        let active_room_id = irc_state.active_room_id.clone();
        if let Some(room) = irc_state.rooms.get_mut(channel) {
            if let Some(lobby) = &mut room.lobby_state {
                match duration {
                    Some(secs) => {
                        lobby.timer_start_time = Some(
                            SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs(),
                        );
                        lobby.timer_duration = Some(secs);
                    }
                    None => {
                        lobby.timer_start_time = None;
                        lobby.timer_duration = None;
                    }
                }
                Self::emit_lobby_update(channel, lobby, active_room_id.as_deref(), app_handle);
            }
        }
    }
}
