// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use tauri::Manager;
use tauri::PathResolverId; 

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

#[tauri::command]
async fn get_path(app_handle: tauri::AppHandle, filename: String, base_dir: PathResolverId) -> Result<String, String> {
    let path = match base_dir {
        PathResolverId::Audio => app_handle.path_resolver().audio_dir(),
        PathResolverId::Cache => app_handle.path_resolver().cache_dir(),
        PathResolverId::Config => app_handle.path_resolver().config_dir(),
        PathResolverId::Data => app_handle.path_resolver().data_dir(),
        PathResolverId::LocalData => app_handle.path_resolver().local_data_dir(),
        PathResolverId::Document => app_handle.path_resolver().document_dir(),
        PathResolverId::Download => app_handle.path_resolver().download_dir(),
        PathResolverId::Picture => app_handle.path_resolver().picture_dir(),
        PathResolverId::Public => app_handle.path_resolver().public_dir(),
        PathResolverId::Video => app_handle.path_resolver().video_dir(),
        PathResolverId::Resource => app_handle.path_resolver().resource_dir(),
        PathResolverId::Temp => app_handle.path_resolver().temp_dir(),
        PathResolverId::AppConfig => app_handle.path_resolver().app_config_dir(),
        PathResolverId::AppData => app_handle.path_resolver().app_data_dir(),
        PathResolverId::AppLocalData => app_handle.path_resolver().app_local_data_dir(),
        PathResolverId::AppCache => app_handle.path_resolver().app_cache_dir(),
        PathResolverId::AppLog => app_handle.path_resolver().app_log_dir(),
        PathResolverId::Desktop => app_handle.path_resolver().desktop_dir(),
        PathResolverId::Executable => app_handle.path_resolver().executable_dir(),
        PathResolverId::Font => app_handle.path_resolver().font_dir(),
        PathResolverId::Home => app_handle.path_resolver().home_dir(),
        PathResolverId::Runtime => app_handle.path_resolver().runtime_dir(),
        PathResolverId::Template => app_handle.path_resolver().template_dir(),
    }.map(|dir| dir.join(filename))
    .ok_or_else(|| format!("Failed to get directory for {:?}", base_dir))?;
    
    Ok(path.to_string_losix())
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
                        file_name: Some("heda-app".to_string()),
                    },
                ))
                .format(|out, message, record| {
                    out.finish(format_args!(
                        "[{} {}] {}",
                        record.level(),
                        record.target(),
                        message
                    ))
                })
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
