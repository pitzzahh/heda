//! Android-only glue for files picked in the system file picker. Those arrive
//! as `content://` URIs, which carry no usable file name or size.

use serde::{Deserialize, Serialize};
use tauri::plugin::{Builder, PluginHandle, TauriPlugin};
use tauri::{AppHandle, Manager, Runtime, Wry};

/// Registers `DocumentsPlugin.kt` (`gen/android/app/src/main/java/com/peterjohnarao/heda`).
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("heda-documents")
        .setup(|app, api| {
            let handle = api.register_android_plugin("com.peterjohnarao.heda", "DocumentsPlugin")?;
            app.manage(Documents(handle));
            Ok(())
        })
        .build()
}

struct Documents<R: Runtime>(PluginHandle<R>);

/// What the document provider reports. Either field may be unknown.
#[derive(Default, Serialize, Deserialize)]
pub struct DocumentInfo {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    size: Option<u64>,
}

#[derive(Serialize)]
struct DocumentArgs {
    uri: String,
}

/// The display name and size of a picked document. A provider that cannot
/// answer yields an empty result, never an error: callers fall back.
#[tauri::command]
pub async fn document_info(app: AppHandle, uri: String) -> DocumentInfo {
    // Async: a sync command would wait for Kotlin on the main thread it needs.
    let Some(handle) = app.try_state::<Documents<Wry>>().map(|state| state.0.clone()) else {
        return DocumentInfo::default();
    };
    handle
        .run_mobile_plugin_async("documentInfo", DocumentArgs { uri })
        .await
        .unwrap_or_else(|err| {
            log::warn!("could not read document info: {err}");
            DocumentInfo::default()
        })
}
