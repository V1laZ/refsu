use crate::irc_handler::handle_irc_connection;
use crate::osu_api::*;
use crate::types::*;
use anyhow::Result;
use irc::client::prelude::*;
use std::sync::Arc;
use tauri::{Emitter, State};

fn emit_rooms_list_updated(app_handle: &tauri::AppHandle, state: &IrcState) {
    let rooms_response = {
        let irc_state = state.lock().unwrap();
        RoomsListResponse {
            rooms: irc_state.rooms.values().map(RoomListItem::from).collect(),
            active_room_id: irc_state.active_room_id.clone(),
        }
    };

    let _ = app_handle.emit("rooms-list-updated", rooms_response);
}

#[tauri::command]
pub async fn connect_to_bancho(
    config: ConnectionConfig,
    state: State<'_, IrcState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    println!("Attempting to connect to osu! Bancho...");

    {
        let irc_state = state.lock().unwrap();
        if irc_state.connected {
            return Err("Already connected to IRC".to_string());
        }
    }

    let irc_config = Config {
        nickname: Some(config.username.clone()),
        server: Some("irc.ppy.sh".to_string()),
        port: Some(6667),
        username: Some(config.username.clone()),
        password: Some(config.password.clone()),
        use_tls: Some(false),
        ..Config::default()
    };

    match irc::client::Client::from_config(irc_config).await {
        Ok(client) => {
            println!("IRC client created successfully");

            if let Err(e) = client.identify() {
                return Err(format!("Failed to identify: {}", e));
            }

            println!("Connected to osu! Bancho!");

            let (tx, rx) = tokio::sync::mpsc::unbounded_channel::<IrcCommand>();

            {
                let mut irc_state = state.lock().unwrap();
                irc_state.connected = true;
                irc_state.config = Some(config.clone());
                irc_state.current_username = Some(config.username.clone());
                irc_state.message_sender = Some(tx);
            }

            let state_clone = Arc::clone(&state.inner());
            let app_handle_clone = app_handle.clone();

            tokio::spawn(async move {
                handle_irc_connection(client, app_handle_clone, state_clone, rx).await;
            });

            // Rejoin all previously joined channels and multiplayer lobbies
            {
                let irc_state = state.lock().unwrap();
                let message_sender = irc_state.message_sender.clone();
                let rooms_to_rejoin: Vec<String> = irc_state
                    .rooms
                    .iter()
                    .filter_map(|(room_id, room)| match room.room_type {
                        RoomType::Channel | RoomType::MultiplayerLobby => Some(room_id.clone()),
                        _ => None,
                    })
                    .collect();
                if let Some(sender) = message_sender {
                    for room_id in rooms_to_rejoin {
                        let _ = sender.send(IrcCommand::JoinChannel { channel: room_id });
                    }
                }
            }
            Ok("Successfully connected to osu! Bancho".to_string())
        }
        Err(e) => {
            println!("Failed to create IRC client: {}", e);
            Err(format!("Failed to connect: {}", e))
        }
    }
}

#[tauri::command]
pub async fn send_message_to_room(
    room_id: String,
    message: String,
    state: State<'_, IrcState>,
) -> Result<String, String> {
    let sender = {
        let irc_state = state.lock().unwrap();
        if !irc_state.connected {
            return Err("Not connected to IRC".to_string());
        }
        irc_state.message_sender.clone()
    };

    if let Some(sender) = sender {
        let room = {
            let irc_state = state.lock().unwrap();
            irc_state.rooms.get(&room_id).cloned()
        };

        if let Some(room) = room {
            let command = match room.room_type {
                RoomType::Channel | RoomType::MultiplayerLobby => {
                    if message.trim() == "!mp settings" {
                        clear_lobby_state(&room_id, &state);
                    }
                    IrcCommand::SendMessage { room_id, message }
                }
                RoomType::PrivateMessage => IrcCommand::SendPrivateMessage {
                    username: room_id,
                    message,
                },
            };

            if let Err(_) = sender.send(command) {
                return Err("Failed to queue message for sending".to_string());
            }
            Ok("Message queued for sending".to_string())
        } else {
            Err("Room not found".to_string())
        }
    } else {
        Err("Message sender not available".to_string())
    }
}

#[tauri::command]
pub async fn join_channel(room_id: String, state: State<'_, IrcState>) -> Result<String, String> {
    let sender = {
        let irc_state = state.lock().unwrap();
        if !irc_state.connected {
            return Err("Not connected to IRC".to_string());
        }

        if irc_state.rooms.contains_key(&room_id) {
            return Err("Already in this room".to_string());
        }

        irc_state.message_sender.clone()
    };

    if let Some(sender) = sender {
        let command = IrcCommand::JoinChannel {
            channel: room_id.clone(),
        };
        if let Err(_) = sender.send(command) {
            return Err("Failed to queue join command".to_string());
        }

        Ok(format!("Joining channel: {}", room_id))
    } else {
        Err("Message sender not available".to_string())
    }
}

#[tauri::command]
pub async fn leave_channel(room_id: String, state: State<'_, IrcState>) -> Result<String, String> {
    let sender = {
        let irc_state = state.lock().unwrap();
        if !irc_state.connected {
            return Err("Not connected to IRC".to_string());
        }
        irc_state.message_sender.clone()
    };

    if let Some(sender) = sender {
        let command = IrcCommand::LeaveChannel {
            channel: room_id.clone(),
        };
        if let Err(_) = sender.send(command) {
            return Err("Failed to queue leave command".to_string());
        }

        Ok(format!("Left channel: {}", room_id))
    } else {
        Err("Message sender not available".to_string())
    }
}

#[tauri::command]
pub async fn close_private_message(
    username: String,
    state: State<'_, IrcState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    remove_room(&username, &state);

    emit_rooms_list_updated(&app_handle, &state);

    Ok(format!("Closed private message with {}", username))
}

#[tauri::command]
pub async fn reconnect_to_bancho(
    state: State<'_, IrcState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let config = {
        let irc_state = state.lock().unwrap();
        if irc_state.connected {
            return Ok("Already connected".to_string());
        }
        irc_state.config.clone()
    };

    if let Some(config) = config {
        connect_to_bancho(config, state, app_handle).await
    } else {
        Err("No previous config found".to_string())
    }
}

#[tauri::command]
pub async fn disconnect_from_bancho(
    state: State<'_, IrcState>,
    _app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let sender = {
        let irc_state = state.lock().unwrap();
        if !irc_state.connected {
            return Err("Not connected".to_string());
        }
        irc_state.message_sender.clone()
    };

    if let Some(sender) = sender {
        let command = IrcCommand::Disconnect;
        if let Err(_) = sender.send(command) {
            // If sending fails, force disconnect
            let mut irc_state = state.lock().unwrap();
            irc_state.connected = false;
            irc_state.rooms.clear();
            irc_state.active_room_id = None;
            irc_state.config = None;
            irc_state.client = None;
            irc_state.message_sender = None;
            irc_state.current_username = None;
        }
    }

    Ok("Disconnected from osu! Bancho".to_string())
}

#[tauri::command]
pub async fn get_connection_status(state: State<'_, IrcState>) -> Result<bool, String> {
    let irc_state = state.lock().unwrap();
    Ok(irc_state.connected)
}

#[tauri::command]
pub async fn set_mention_keywords(
    keywords: Vec<String>,
    state: State<'_, IrcState>,
) -> Result<(), String> {
    let mut irc_state = state.lock().unwrap();
    irc_state.mention_keywords = keywords
        .into_iter()
        .map(|k| k.trim().to_lowercase())
        .filter(|k| !k.is_empty())
        .collect();
    Ok(())
}

#[tauri::command]
pub async fn set_app_focused(focused: bool, state: State<'_, IrcState>) -> Result<(), String> {
    let mut irc_state = state.lock().unwrap();
    irc_state.app_focused = focused;
    Ok(())
}

#[tauri::command]
pub async fn set_os_notifications_enabled(
    enabled: bool,
    state: State<'_, IrcState>,
) -> Result<(), String> {
    let mut irc_state = state.lock().unwrap();
    irc_state.os_notifications_enabled = enabled;
    Ok(())
}

#[tauri::command]
pub async fn get_rooms_list(state: State<'_, IrcState>) -> Result<RoomsListResponse, String> {
    let irc_state = state.lock().unwrap();
    Ok(RoomsListResponse {
        rooms: irc_state.rooms.values().map(RoomListItem::from).collect(),
        active_room_id: irc_state.active_room_id.clone(),
    })
}

#[tauri::command]
pub async fn get_room_state(
    room_id: String,
    state: State<'_, IrcState>,
) -> Result<Option<RoomPage>, String> {
    let irc_state = state.lock().unwrap();
    if let Some(room) = irc_state.rooms.get(&room_id) {
        Ok(Some(room.to_room_page(MESSAGE_PAGE_SIZE)))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn set_active_room(
    room_id: String,
    state: State<'_, IrcState>,
) -> Result<RoomPage, String> {
    let room_page = {
        let mut irc_state = state.lock().unwrap();

        if !irc_state.rooms.contains_key(&room_id) {
            return Err("Room not found".to_string());
        }

        irc_state.active_room_id = Some(room_id.clone());

        if let Some(room) = irc_state.rooms.get_mut(&room_id) {
            room.mark_as_read();
            room.to_room_page(MESSAGE_PAGE_SIZE)
        } else {
            return Err("Room not found".to_string());
        }
    };

    Ok(room_page)
}

#[tauri::command]
pub async fn get_room_messages_page(
    room_id: String,
    offset: usize,
    limit: usize,
    state: State<'_, IrcState>,
) -> Result<MessagesPage, String> {
    let irc_state = state.lock().unwrap();
    if let Some(room) = irc_state.rooms.get(&room_id) {
        Ok(room.get_messages_page(offset, limit))
    } else {
        Err("Room not found".to_string())
    }
}

#[tauri::command]
pub async fn start_private_message(
    username: String,
    state: State<'_, IrcState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    {
        let mut irc_state = state.lock().unwrap();

        if irc_state.rooms.contains_key(&username) {
            return Ok(format!(
                "Private message room with {} already exists",
                username
            ));
        }

        // Add new PM room as inactive - frontend will activate it if needed
        let room = Room::new_private_message(username.clone());
        irc_state.rooms.insert(username.clone(), room);
    }

    emit_rooms_list_updated(&app_handle, &state);

    Ok(format!("Started private message with {}", username))
}

#[tauri::command]
pub async fn set_mappool(
    room_id: String,
    mappool_id: Option<u64>,
    state: State<'_, IrcState>,
) -> Result<Option<u64>, String> {
    let mut irc_state = state.lock().unwrap();
    if let Some(room) = irc_state.rooms.get_mut(&room_id) {
        if let Some(lobby_state) = &mut room.lobby_state {
            lobby_state.current_mappool_id = mappool_id;
            return Ok(mappool_id);
        }
    }
    Err("Lobby state not found".to_string())
}

#[tauri::command]
pub async fn set_map_drain_time(
    room_id: String,
    drain_time: u32,
    state: State<'_, IrcState>,
) -> Result<(), String> {
    let mut irc_state = state.lock().unwrap();
    if let Some(room) = irc_state.rooms.get_mut(&room_id) {
        if let Some(lobby) = &mut room.lobby_state {
            lobby.map_drain_time = Some(drain_time);
            return Ok(());
        }
    }
    Err("Lobby not found".to_string())
}

#[tauri::command]
pub async fn set_lobby_command_defaults(
    room_id: String,
    timer_seconds: u32,
    start_seconds: u32,
    state: State<'_, IrcState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let (lobby, is_active) = {
        let mut irc_state = state.lock().unwrap();
        let is_active = irc_state.active_room_id.as_deref() == Some(&room_id);
        let room = irc_state
            .rooms
            .get_mut(&room_id)
            .ok_or_else(|| "Room not found".to_string())?;
        let lobby = room
            .lobby_state
            .as_mut()
            .ok_or_else(|| "Lobby not found".to_string())?;
        lobby.default_timer_seconds = timer_seconds;
        lobby.default_start_seconds = start_seconds;
        (lobby.clone(), is_active)
    };

    if is_active {
        let _ = app_handle.emit(
            "active-room-lobby-state-updated",
            serde_json::json!({ "lobbyState": lobby }),
        );
    }

    Ok(())
}

#[tauri::command]
pub async fn fetch_beatmap_data(
    beatmap_id: String,
    access_token: String,
) -> Result<BeatmapData, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(&format!(
            "https://osu.ppy.sh/api/v2/beatmaps/{}",
            beatmap_id
        ))
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Content-Type", "application/json")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch beatmap data: {}", e))?;

    if !response.status().is_success() {
        if response.status().as_u16() == 404 {
            return Err("Beatmap not found".to_string());
        }
        return Err(format!(
            "Failed to fetch beatmap data: {}",
            response.status()
        ));
    }

    let api_response: OsuApiBeatmapResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse API response: {}", e))?;

    Ok(BeatmapData {
        id: api_response.id,
        beatmapset_id: api_response.beatmapset_id,
        artist: api_response.beatmapset.artist,
        title: api_response.beatmapset.title,
        difficulty: api_response.version,
        mapper: api_response.beatmapset.creator,
        mode: api_response.mode_int,
        total_length: api_response.total_length,
        bpm: api_response.bpm,
        difficulty_rating: api_response.difficulty_rating,
    })
}

#[tauri::command]
pub async fn fetch_user_data(username: String, access_token: String) -> Result<UserData, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(&format!("https://osu.ppy.sh/api/v2/users/@{}", username))
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Content-Type", "application/json")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch user data: {}", e))?;

    if !response.status().is_success() {
        if response.status().as_u16() == 404 {
            return Err("User not found".to_string());
        }
        return Err(format!("Failed to fetch user data: {}", response.status()));
    }

    let api_response: OsuApiUserResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse API response: {}", e))?;

    Ok(UserData {
        id: api_response.id,
        username: api_response.username,
        avatar_url: api_response.avatar_url,
        country: api_response.country.code,
        pp: api_response.statistics.pp,
        rank: api_response.statistics.global_rank,
        country_rank: api_response.statistics.country_rank,
        accuracy: api_response.statistics.hit_accuracy,
    })
}

pub fn remove_room(room_id: &str, state: &IrcState) {
    let mut irc_state = state.lock().unwrap();
    irc_state.rooms.remove(room_id);

    // Clear active_room_id if the removed room was active
    if irc_state.active_room_id.as_deref() == Some(room_id) {
        irc_state.active_room_id = None;
    }
}

pub fn clear_lobby_state(room_id: &str, state: &IrcState) {
    let mut irc_state = state.lock().unwrap();
    if let Some(room) = irc_state.rooms.get_mut(room_id) {
        if let Some(lobby) = &mut room.lobby_state {
            for slot in &mut lobby.slots {
                slot.player = None;
            }
            lobby.match_status = "idle".to_string();
        }
    }
}

#[cfg(desktop)]
#[tauri::command]
pub async fn check_for_updates(
    app_handle: tauri::AppHandle,
) -> Result<Option<serde_json::Value>, String> {
    use tauri_plugin_updater::UpdaterExt;

    match app_handle.updater() {
        Ok(updater) => match updater.check().await {
            Ok(Some(update)) => {
                let date_str = update.date.map(|d| d.to_string());

                let update_info = serde_json::json!({
                    "available": true,
                    "current_version": update.current_version,
                    "latest_version": update.version,
                    "date": date_str,
                    "body": update.body,
                });
                Ok(Some(update_info))
            }
            Ok(None) => Ok(None),
            Err(e) => Err(format!("Failed to check for updates: {}", e)),
        },
        Err(e) => Err(format!("Failed to get updater: {}", e)),
    }
}

#[cfg(desktop)]
#[tauri::command]
pub async fn install_update(app_handle: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;

    match app_handle.updater() {
        Ok(updater) => match updater.check().await {
            Ok(Some(update)) => {
                update
                    .download_and_install(
                        |chunk_length, content_length| {
                            if let Some(total) = content_length {
                                let percentage = (chunk_length as f64 / total as f64) * 100.0;
                                let _ = app_handle.emit("update-download-progress", percentage);
                            }
                        },
                        || {
                            let _ = app_handle.emit("update-download-complete", ());
                        },
                    )
                    .await
                    .map_err(|e| format!("Failed to install update: {}", e))?;

                Ok(())
            }
            Ok(None) => Err("No update available".to_string()),
            Err(e) => Err(format!("Failed to check for updates: {}", e)),
        },
        Err(e) => Err(format!("Failed to get updater: {}", e)),
    }
}

// Mobile stub - these functions only work on desktop
#[cfg(not(desktop))]
#[tauri::command]
pub async fn check_for_updates(
    _app_handle: tauri::AppHandle,
) -> Result<Option<serde_json::Value>, String> {
    Err("Updates are not supported on mobile platforms".to_string())
}

#[cfg(not(desktop))]
#[tauri::command]
pub async fn install_update(_app_handle: tauri::AppHandle) -> Result<(), String> {
    Err("Updates are not supported on mobile platforms".to_string())
}
