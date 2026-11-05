use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(desktop)]
    let log_plugin = tauri_plugin_log::Builder::new()
        .target(tauri_plugin_log::Target::new(
            tauri_plugin_log::TargetKind::Folder {
                path: dirs::home_dir().unwrap(),
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
        .build();
    #[cfg(mobile)]
    let log_plugin = tauri_plugin_log::Builder::new().build();

    let builder = tauri::Builder::default()
        .plugin(log_plugin)
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_file_name,
            get_file_metadata,
            get_exe_path
        ]);

    // In-app updating and relaunching exist on desktop only; Android installs the APK by hand.
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    builder
        .setup(|app| {
            use tauri::Manager;
            let salt_path = app
                .path()
                .app_local_data_dir()
                .expect("could not resolve app local data path")
                .join("heda-k");
            app.handle()
                .plugin(tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build())
                .expect("failed to register stronghold plugin");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
