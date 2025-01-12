// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

#[tauri::command]
fn get_env_var(key: String) -> String {
    std::env::var(String::from(key)).unwrap_or(String::from(""))
}

#[tauri::command]
fn get_file_name(path: String) -> String {
    let path = Path::new(path.as_str());
    let filename = path.file_stem().unwrap_or_default();
    filename.to_str().unwrap().to_string()
}

#[tauri::command]
fn get_file_metadata(path: String) -> Result<(u64, SystemTime), String> {
    let path = PathBuf::from(path);
    match fs::metadata(&path) {
        Ok(metadata) => Ok((metadata.len(), metadata.modified().unwrap())),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn get_exe_path() -> PathBuf {
    std::env::current_exe()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf()
}

fn main() {
    dotenv::from_read(include_str!("../../.env").as_bytes())
        .unwrap()
        .load();

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::Folder {
                        path: get_exe_path(),
                        file_name: Some("heda-app.log".to_string()),
                    },
                ))
                .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
                .build(),
        )
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_env_var,
            get_file_name,
            get_file_metadata,
            get_exe_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
