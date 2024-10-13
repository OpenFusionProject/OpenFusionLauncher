mod state;
mod util;

use state::{AppState, Servers};

use std::sync::Mutex;

use log::*;
use tauri::Manager;
use uuid::Uuid;

type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;

fn save_app_state(app_handle: &tauri::AppHandle) {
    let app_state = app_handle.state::<Mutex<AppState>>();
    let app_state = app_state.lock().unwrap();
    app_state.save();
}

#[tauri::command]
fn get_servers(state: tauri::State<Mutex<AppState>>) -> Servers {
    match state.lock() {
        Ok(state) => state.servers.clone(),
        Err(e) => {
            error!("Failed to lock app state: {}", e);
            Servers::default()
        }
    }
}

#[tauri::command]
fn connect_to_server(uuid: String) {
    if let Ok(uuid) = Uuid::parse_str(&uuid) {
        info!("Connecting to server {}", uuid);
    } else {
        warn!("Invalid server UUID: {}", uuid);
    }
}

#[allow(clippy::single_match)]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            state::init_app_statics(app);
            // N.B. AppState::load depends on APP_STATICS
            let app_state = AppState::load();
            app.manage(Mutex::new(app_state));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_servers, connect_to_server])
        .build(tauri::generate_context![])
        .unwrap()
        .run(|app_handle, event| match event {
            tauri::RunEvent::Exit { .. } => save_app_state(app_handle),
            _ => {}
        });
}
