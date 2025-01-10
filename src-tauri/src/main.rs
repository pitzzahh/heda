// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::Path;

#[tauri::command]
fn get_env_var(key: String) -> String {
    std::env::var(String::from(key)).unwrap_or(String::from(""))
}

#[tauri::command]
fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    std::fs::rename(old_path, new_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_file_name(path: String) -> String {
    let path = Path::new(path.as_str());
    let filename = path.file_stem().unwrap_or_default();
    filename.to_str().unwrap().to_string()
}

fn main() {
    let result = dotenv::from_read(include_str!("../../.env").as_bytes()).unwrap();
    result.load();
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_log::Builder::new()
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::Stdout,
        .invoke_handler(tauri::generate_handler![get_env_var, get_file_name, rename_file])
                .build(),
        )
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![get_env_var, get_file_name])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

