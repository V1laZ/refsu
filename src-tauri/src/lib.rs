mod banchobot_parser;
mod commands;
mod irc_handler;
mod migrations;
mod osu_api;
mod types;

use base64::Engine;
use commands::*;
use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;

use crate::migrations::get_migrations;
use crate::types::IrcState;

#[cfg(target_os = "android")]
#[no_mangle]
pub extern "system" fn Java_dev_vilaz_refsu_RustInit_initVerifier<'local>(
    mut unowned_env: jni::EnvUnowned<'local>,
    _class: jni::objects::JClass<'local>,
    context: jni::objects::JObject<'local>,
) {
    unowned_env
        .with_env(|env| -> jni::errors::Result<()> {
            rustls_platform_verifier::android::init_with_env(env, context)?;
            Ok(())
        })
        .resolve::<jni::errors::ThrowRuntimeExAndDefault>();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = get_migrations();

    let mut builder = tauri::Builder::default().plugin(tauri_plugin_os::init());

    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
                let _ = app
                    .get_webview_window("main")
                    .expect("no main window")
                    .set_focus();
            }))
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init());
    }

    #[cfg(target_os = "android")]
    {
        builder = builder.plugin(tauri_plugin_android_battery_optimization::init());
    }

    builder
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:refsu_database.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .manage(IrcState::default())
        .invoke_handler(tauri::generate_handler![
            connect_to_bancho,
            reconnect_to_bancho,
            disconnect_from_bancho,
            send_message_to_room,
            join_channel,
            leave_channel,
            close_private_message,
            get_connection_status,
            get_rooms_list,
            set_active_room,
            start_private_message,
            fetch_beatmap_data,
            fetch_user_data,
            set_mappool,
            set_map_drain_time,
            set_lobby_command_defaults,
            get_room_state,
            get_room_messages_page,
            check_for_updates,
            install_update,
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                let urls = event.urls();
                let Some(url) = urls.first() else {
                    eprintln!("Deep link fired with no URL");
                    return;
                };
                println!("Received deep link: {}", url);

                let query = url
                    .query_pairs()
                    .map(|(k, v)| (k.to_string(), v.to_string()))
                    .collect::<std::collections::HashMap<_, _>>();

                let Some(base64_data) = query.get("data") else {
                    eprintln!(
                        "Deep link missing `data` query param (got keys: {:?}). \
                         If this is the OAuth /callback URL it means Android intercepted \
                         it before the worker could exchange the code for a token.",
                        query.keys().collect::<Vec<_>>()
                    );
                    return;
                };

                let decoded_bytes =
                    match base64::engine::general_purpose::STANDARD.decode(base64_data) {
                        Ok(b) => b,
                        Err(e) => {
                            eprintln!("Deep link `data` is not valid base64: {}", e);
                            return;
                        }
                    };
                let decoded_string = match String::from_utf8(decoded_bytes) {
                    Ok(s) => s,
                    Err(e) => {
                        eprintln!("Deep link `data` is not valid UTF-8: {}", e);
                        return;
                    }
                };
                let token_data = match serde_json::from_str::<serde_json::Value>(&decoded_string) {
                    Ok(v) => v,
                    Err(e) => {
                        eprintln!("Deep link `data` is not valid JSON: {}", e);
                        return;
                    }
                };

                if let Err(e) = app_handle.emit("oauth-token-callback", token_data) {
                    eprintln!("Failed to emit oauth-token-callback event: {}", e);
                }
            });

            #[cfg(desktop)]
            {
                if let Err(err) = app.deep_link().register("refsu") {
                    eprintln!("Failed to register deep link: {}", err);
                }
            }

            #[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
            {
                app.deep_link().register_all()?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
