use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::Emitter;

// Room types
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum RoomType {
    Channel,
    PrivateMessage,
    MultiplayerLobby,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Room {
    pub id: String,
    pub display_name: String,
    pub room_type: RoomType,
    pub messages: Vec<IrcMessage>,
    pub unread_count: u32,
    pub lobby_state: Option<LobbyState>,
}

impl Room {
    pub fn new_channel(channel_name: String) -> Self {
        let is_multiplayer = channel_name.starts_with("#mp_");
        let room_type = if is_multiplayer {
            RoomType::MultiplayerLobby
        } else {
            RoomType::Channel
        };

        let lobby_state = if is_multiplayer {
            Some(LobbyState::new())
        } else {
            None
        };

        Self {
            display_name: channel_name.clone(),
            id: channel_name,
            room_type,
            messages: Vec::new(),
            unread_count: 0,
            lobby_state,
        }
    }

    pub fn new_private_message(username: String) -> Self {
        Self {
            id: username.clone(),
            display_name: username,
            room_type: RoomType::PrivateMessage,
            messages: Vec::new(),
            unread_count: 0,
            lobby_state: None,
        }
    }

    pub fn add_message(&mut self, message: IrcMessage, is_active: bool) {
        self.messages.push(message);
        if !is_active {
            self.unread_count += 1;
        }
    }

    pub fn mark_as_read(&mut self) {
        self.unread_count = 0;
    }

    pub fn to_room_page(&self, limit: usize) -> RoomPage {
        let total = self.messages.len();
        let start = total.saturating_sub(limit);
        RoomPage {
            id: self.id.clone(),
            display_name: self.display_name.clone(),
            room_type: self.room_type.clone(),
            messages: self.messages[start..].to_vec(),
            unread_count: self.unread_count,
            lobby_state: self.lobby_state.clone(),
            has_more_messages: start > 0,
        }
    }

    pub fn get_messages_page(&self, offset: usize, limit: usize) -> MessagesPage {
        let total = self.messages.len();
        if offset >= total {
            return MessagesPage {
                messages: vec![],
                has_more: false,
            };
        }
        let end = total - offset;
        let start = end.saturating_sub(limit);
        MessagesPage {
            messages: self.messages[start..end].to_vec(),
            has_more: start > 0,
        }
    }
}

pub const MESSAGE_PAGE_SIZE: usize = 20;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RoomPage {
    pub id: String,
    pub display_name: String,
    pub room_type: RoomType,
    pub messages: Vec<IrcMessage>,
    pub unread_count: u32,
    pub lobby_state: Option<LobbyState>,
    pub has_more_messages: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MessagesPage {
    pub messages: Vec<IrcMessage>,
    pub has_more: bool,
}

// Lightweight room list item without messages
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RoomListItem {
    pub id: String,
    pub display_name: String,
    pub room_type: RoomType,
    pub unread_count: u32,
}

impl From<&Room> for RoomListItem {
    fn from(room: &Room) -> Self {
        Self {
            id: room.id.clone(),
            display_name: room.display_name.clone(),
            room_type: room.room_type.clone(),
            unread_count: room.unread_count,
        }
    }
}

// Response for get_rooms_list command
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RoomsListResponse {
    pub rooms: Vec<RoomListItem>,
    pub active_room_id: Option<String>,
}

// Lobby state structures
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Player {
    pub username: String,
    pub team: Option<String>, // "red" or "blue"
    pub is_ready: bool,
    pub is_playing: bool,
    pub is_host: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlayerSlot {
    pub id: u8,
    pub player: Option<Player>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CurrentMap {
    pub beatmap_id: u64,
    pub title: String,
    pub difficulty: String,
    pub artist: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LobbySettings {
    pub room_name: String,
    pub team_mode: String,     // "HeadToHead", "TagCoop", "TeamVs", "TagTeamVs"
    pub win_condition: String, // "Score", "Accuracy", "Combo", "ScoreV2"
    pub size: u8,
    pub password: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LobbyState {
    pub settings: Option<LobbySettings>,
    pub current_map: Option<CurrentMap>,
    pub slots: Vec<PlayerSlot>,
    pub match_status: String, // "idle", "ready", "starting", "active"
    pub host: Option<String>,
    pub freemod: bool,
    pub selected_mods: Vec<String>,
    pub current_mappool_id: Option<u64>,
    pub match_start_time: Option<u64>,
    pub map_drain_time: Option<u32>,
    pub timer_start_time: Option<u64>,
    pub timer_duration: Option<u32>,
    pub default_timer_seconds: u32,
    pub default_start_seconds: u32,
}

impl LobbyState {
    pub fn new() -> Self {
        let slots = (1..=16).map(|id| PlayerSlot { id, player: None }).collect();

        Self {
            settings: None,
            current_map: None,
            current_mappool_id: None,
            slots,
            match_status: "idle".to_string(),
            host: None,
            freemod: false,
            selected_mods: Vec::new(),
            match_start_time: None,
            map_drain_time: None,
            timer_start_time: None,
            timer_duration: None,
            default_timer_seconds: 30,
            default_start_seconds: 10,
        }
    }
}

// IRC client state
#[derive(Debug)]
pub struct IrcClientState {
    pub connected: bool,
    pub rooms: HashMap<String, Room>,
    pub active_room_id: Option<String>,
    pub config: Option<ConnectionConfig>,
    pub client: Option<Arc<Mutex<irc::client::Client>>>,
    pub message_sender: Option<tokio::sync::mpsc::UnboundedSender<IrcCommand>>,
    pub current_username: Option<String>,
}

#[derive(Debug, Clone)]
pub enum IrcCommand {
    SendMessage { room_id: String, message: String },
    JoinChannel { channel: String },
    LeaveChannel { channel: String },
    SendPrivateMessage { username: String, message: String },
    Disconnect,
}

impl Default for IrcClientState {
    fn default() -> Self {
        Self {
            connected: false,
            rooms: HashMap::new(),
            active_room_id: None,
            config: None,
            client: None,
            message_sender: None,
            current_username: None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IrcMessage {
    pub room_id: String,
    pub username: String,
    pub message: String,
    pub timestamp: u64,
    pub is_private: bool,
}

#[derive(Debug, Serialize, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub enum SoundNotificationKind {
    Mention,
    MatchStart,
    MatchFinish,
    AllReady,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SoundNotification {
    #[serde(rename = "type")]
    pub kind: SoundNotificationKind,
    pub room_id: String,
}

pub fn emit_sound_notification(
    app_handle: &tauri::AppHandle,
    kind: SoundNotificationKind,
    room_id: &str,
) {
    let _ = app_handle.emit(
        "sound-notification",
        SoundNotification {
            kind,
            room_id: room_id.to_string(),
        },
    );
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConnectionConfig {
    pub username: String,
    pub password: String,
}

pub type IrcState = Arc<Mutex<IrcClientState>>;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OAuthCallbackData {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i32,
}
