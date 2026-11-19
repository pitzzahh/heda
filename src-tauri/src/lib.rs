use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime};

#[cfg(desktop)]
use tauri::webview::NewWindowResponse;
#[cfg(desktop)]
use tauri::WebviewUrl;
use tauri::{AppHandle, Emitter, Manager, WebviewWindowBuilder};
use tauri_plugin_fs::FsExt;

#[cfg(target_os = "android")]
mod android;

/// Every engine call (`crates/heda-core`): the open project lives here, in the app
/// process, so a webview reload finds it again and a fresh launch starts empty.
#[tauri::command]
fn heda(
    session: tauri::State<'_, Mutex<heda_core::session::Session>>,
    command: String,
    args: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let mut session = session
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    heda_core::dispatch::dispatch(&mut session, &command, args)
}

/// The permit sheet set PDF of the open project (`heda_core::sheet_set`), as raw bytes
/// rather than JSON. Async, so a large project builds off the main thread.
#[tauri::command]
async fn sheet_set(
    session: tauri::State<'_, Mutex<heda_core::session::Session>>,
    project_name: String,
    date: String,
) -> Result<tauri::ipc::Response, String> {
    let mut session = session
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    session
        .sheet_set(project_name, date)
        .map(tauri::ipc::Response::new)
}

#[tauri::command]
fn get_file_name(path: String) -> String {
    let path = Path::new(path.as_str());
    path.file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .into_owned()
}

#[tauri::command]
fn get_file_metadata(path: String) -> Result<(u64, SystemTime), String> {
    let path = PathBuf::from(path);
    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
    // Some filesystems do not record a modification time.
    let modified = metadata.modified().map_err(|e| e.to_string())?;
    Ok((metadata.len(), modified))
}

/// One random key per installation, used to encrypt `.heda` files without a
/// password. Kept out of the session wipe list and written owner-only on Unix.
/// The file name is deliberately nondescript (`heda-d` = device key).
const DEVICE_KEY_FILE: &str = "heda-d";

#[tauri::command]
fn load_device_key(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|err| err.to_string())?;
    match fs::read_to_string(dir.join(DEVICE_KEY_FILE)) {
        Ok(key) => {
            let key = key.trim();
            if key.is_empty() {
                return Err("the device key file is empty".to_string());
            }
            Ok(Some(key.to_string()))
        }
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(err) => Err(err.to_string()),
    }
}

#[tauri::command]
fn store_device_key(app: tauri::AppHandle, key: String) -> Result<(), String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|err| err.to_string())?;
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    let path = dir.join(DEVICE_KEY_FILE);

    let mut options = fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(&path).map_err(|err| err.to_string())?;
    use std::io::Write;
    file.write_all(key.as_bytes())
        .map_err(|err| err.to_string())?;
    file.flush().map_err(|err| err.to_string())?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600))
            .map_err(|err| err.to_string())?;
    }
    Ok(())
}

/// A `.heda` file handed to us by the OS (double-click / "Open With").
///
/// Paths that arrive before the webview has attached its event listener are
/// buffered here and handed over when the frontend pulls them with
/// `take_pending_file_open`; later paths are emitted as `FILE_OPEN_EVENT`.
#[derive(Default)]
struct FileOpenState {
    pending: Mutex<Option<String>>,
    ready: AtomicBool,
}

/// Must match `FILE_OPEN_EVENT` in `src/lib/helpers/file/open-request.ts`.
const FILE_OPEN_EVENT: &str = "file-open-request";

/// Must match `WINDOW_CLOSE_REQUESTED` in `src/lib/helpers/file/close-request.ts`.
const WINDOW_CLOSE_REQUESTED: &str = "window-close-requested";

fn is_heda_file(arg: &str) -> bool {
    Path::new(arg)
        .extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("heda"))
}

/// Grants the frontend's fs scope the folder of a `.heda` file, not
/// recursive: the file plus the temp and backup files written next to it on
/// save, convert and migration. The capability allows no user folders on its
/// own, so this is how the webview reaches a project file outside a dialog.
///
/// The file must exist, or be a path the user just picked in a save dialog
/// (the dialog grants that path, sometimes without the `.heda` the frontend
/// appends). Both keep the command from opening arbitrary folders. Returns
/// whether the file exists; nothing is granted for a missing, unpicked file.
fn allow_project_folder_for(app: &AppHandle, path: &str) -> Result<bool, String> {
    let path = Path::new(path);
    if !is_heda_file(&path.to_string_lossy()) || !path.is_absolute() {
        return Err("expected an absolute path to a .heda file".to_string());
    }
    let exists = path.is_file();
    let scope = app.fs_scope();
    let picked = scope.is_allowed(path) || scope.is_allowed(path.with_extension(""));
    if !exists && !picked {
        return Ok(false);
    }
    let folder = path
        .parent()
        .ok_or_else(|| "the file has no parent folder".to_string())?;
    scope
        .allow_directory(folder, false)
        .map_err(|err| err.to_string())?;
    Ok(exists)
}

#[tauri::command]
fn allow_project_folder(app: AppHandle, path: String) -> Result<bool, String> {
    allow_project_folder_for(&app, &path)
}

fn deliver_file_open(app: &tauri::AppHandle, path: String) {
    if !is_heda_file(&path) {
        return;
    }
    // OS-delivered paths never pass through the dialog plugin, so grant the
    // frontend's fs scope explicitly or the read would be denied.
    if let Err(err) = allow_project_folder_for(app, &path) {
        log::warn!("failed to allow opened file in fs scope: {err}");
    }
    let state = app.state::<FileOpenState>();
    let mut pending = state
        .pending
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if state.ready.load(Ordering::SeqCst) {
        drop(pending);
        if let Err(err) = app.emit(FILE_OPEN_EVENT, &path) {
            log::warn!("failed to emit file open request: {err}");
        }
    } else {
        *pending = Some(path);
    }
}

#[tauri::command]
fn take_pending_file_open(state: tauri::State<'_, FileOpenState>) -> Option<String> {
    state.ready.store(true, Ordering::SeqCst);
    state
        .pending
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .take()
}

/// A close request the webview has not acknowledged yet.
///
/// Every close is handed to the webview, which acks it on receipt. If the
/// webview hangs it never does, and without this the window could not be
/// closed at all: a further close request after `CLOSE_ACK_TIMEOUT` quits.
#[derive(Default)]
struct CloseRequestState {
    unanswered_since: Mutex<Option<Instant>>,
}

const CLOSE_ACK_TIMEOUT: Duration = Duration::from_secs(5);

#[tauri::command]
fn ack_close_request(state: tauri::State<'_, CloseRequestState>) {
    *state
        .unanswered_since
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = None;
}

/// Quits the app. The webview invokes this only after the user resolved the
/// unsaved-changes prompt for a prevented close request; `exit` skips the
/// close event, so it cannot re-trigger the prompt.
#[tauri::command]
fn close_main_window(app: AppHandle) {
    app.exit(0);
}

/// The window the app starts with; every other window is a popout of it.
const MAIN_WINDOW: &str = "main";

/// `popout-<id>` for `about:blank#<id>`, where the id is a UUID-like token
/// (ASCII alphanumerics and `-`, as `crypto.randomUUID()` makes); else None.
#[cfg(desktop)]
fn popout_label(url: &tauri::Url) -> Option<String> {
    if url.scheme() != "about" || url.path() != "blank" || url.query().is_some() {
        return None;
    }
    let id = url.fragment()?;
    let valid =
        (1..=64).contains(&id.len()) && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
    valid.then(|| format!("popout-{id}"))
}

/// Builds the main window from `tauri.conf.json` (where it has `create: false`)
/// so it can take a `window.open` handler, which config alone cannot set.
fn build_main_window(app: &AppHandle) -> tauri::Result<()> {
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == MAIN_WINDOW)
        .expect("tauri.conf.json must define the main window")
        .clone();
    let builder = WebviewWindowBuilder::from_config(app, &config)?;
    #[cfg(desktop)]
    let builder = with_popouts(builder, app.clone());
    builder.build()?;
    Ok(())
}

/// The main window's `window.open` handler. Desktop only: Android has one
/// window per app, and the webview there never asks.
///
/// Only `about:blank#<id>` popouts are allowed: the opener renders a panel
/// into them directly, sharing its JS state, so they must stay linked to it
/// (the window features carry that link). Any other URL is denied, never
/// loaded inside the app. The window is labelled `popout-<id>` so the opener
/// can close and focus it natively; a page-side `close()`/`focus()` from the
/// opener is ignored by WebKitGTK. Must match `src/lib/helpers/popout.ts`.
#[cfg(desktop)]
fn with_popouts<'a>(
    builder: WebviewWindowBuilder<'a, tauri::Wry, AppHandle>,
    handle: AppHandle,
) -> WebviewWindowBuilder<'a, tauri::Wry, AppHandle> {
    builder.on_new_window(move |url, features| {
        let Some(label) = popout_label(&url) else {
            log::warn!("denied a window.open request for {url}");
            return NewWindowResponse::Deny;
        };
        let blank = WebviewUrl::External("about:blank".parse().expect("valid url"));
        match WebviewWindowBuilder::new(&handle, label, blank)
            // WebKitGTK drops the requested size; matches Poppable's default.
            // `window_features` overrides it where the platform passes one.
            .inner_size(1100.0, 720.0)
            .window_features(features)
            .on_document_title_changed(|window, title| {
                let _ = window.set_title(&title);
            })
            .build()
        {
            Ok(window) => NewWindowResponse::Create { window },
            Err(err) => {
                log::warn!("failed to open a popout window: {err}");
                NewWindowResponse::Deny
            }
        }
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let log_plugin = tauri_plugin_log::Builder::new()
        // The platform log directory (e.g. ~/.local/share/<identifier>/logs on
        // Linux), not the user's home folder.
        .target(tauri_plugin_log::Target::new(
            tauri_plugin_log::TargetKind::LogDir {
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

    let builder = tauri::Builder::default();
    // Must be registered first: a second launch (another double-click while
    // we run) forwards its arguments here instead of starting a new app
    // that would wipe the open session's files. Android never starts a second
    // instance of an app, so the plugin is desktop only.
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
        if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
            let _ = window.set_focus();
        }
        if let Some(path) = args.into_iter().find(|arg| is_heda_file(arg)) {
            deliver_file_open(app, path);
        }
    }));
    let builder = builder
        .manage(Mutex::new(heda_core::session::Session::default()))
        .manage(FileOpenState::default())
        .manage(CloseRequestState::default())
        .plugin(log_plugin)
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init());
    // Android apps update through the APK or the store, not in place.
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    #[cfg(target_os = "android")]
    let builder = builder.plugin(android::init());

    let app = builder
        .invoke_handler(tauri::generate_handler![
            heda,
            sheet_set,
            get_file_name,
            get_file_metadata,
            allow_project_folder,
            take_pending_file_open,
            ack_close_request,
            close_main_window,
            load_device_key,
            store_device_key,
            #[cfg(target_os = "android")]
            android::document_info
        ])
        .setup(|app| {
            build_main_window(app.handle())?;
            // Built from the bundle version so the title never goes stale.
            if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
                let title = format!(
                    "Hierarchical Electrical Design Analyzer v{}",
                    app.package_info().version
                );
                if let Err(err) = window.set_title(&title) {
                    log::warn!("failed to set window title: {err}");
                }
            }
            // Windows/Linux pass the opened file as a command line argument.
            if let Some(path) = std::env::args_os()
                .filter_map(|arg| arg.into_string().ok())
                .find(|arg| is_heda_file(arg))
            {
                deliver_file_open(app.handle(), path);
            }

            Ok(())
        })
        // Every system close (close button, Alt+F4, Cmd+W) of the main window
        // is prevented and handed to the webview, which runs the unsaved-changes
        // prompt and quits through `close_main_window` only after the user
        // decides. Popouts close normally; the opener docks their content back.
        .on_window_event(|window, event| {
            if window.label() != MAIN_WINDOW {
                return;
            }
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let state = window.state::<CloseRequestState>();
                let mut unanswered_since = state
                    .unanswered_since
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner());
                if unanswered_since.is_some_and(|since| since.elapsed() >= CLOSE_ACK_TIMEOUT) {
                    log::warn!("webview did not answer the close request, quitting");
                    window.app_handle().exit(0);
                    return;
                }
                unanswered_since.get_or_insert_with(Instant::now);
                drop(unanswered_since);
                if let Err(err) = window.emit(WINDOW_CLOSE_REQUESTED, ()) {
                    log::warn!("failed to emit window close request: {err}");
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    #[cfg(target_os = "macos")]
    app.run(|app_handle, event| {
        // macOS delivers opened documents (Finder double-click / "Open With")
        // as file URLs, both on cold start and while already running.
        if let tauri::RunEvent::Opened { urls } = event {
            for url in urls {
                if url.scheme() == "file" {
                    if let Ok(path) = url.to_file_path() {
                        deliver_file_open(app_handle, path.to_string_lossy().into_owned());
                    }
                }
            }
        }
    });

    #[cfg(not(target_os = "macos"))]
    app.run(|_, _| {});
}

#[cfg(test)]
mod tests {
    use super::popout_label;

    fn label(url: &str) -> Option<String> {
        popout_label(&url.parse().unwrap())
    }

    #[test]
    fn popout_label_accepts_only_blank_with_an_id() {
        assert_eq!(
            label("about:blank#3f2a-9b").as_deref(),
            Some("popout-3f2a-9b")
        );
        assert_eq!(label("about:blank"), None);
        assert_eq!(label("about:blank#"), None);
        assert_eq!(label("about:blank?x=1#abc"), None);
        assert_eq!(label("about:blank#a/b"), None);
        assert_eq!(label("about:srcdoc#abc"), None);
        assert_eq!(label("https://example.com/#abc"), None);
        assert_eq!(label(&format!("about:blank#{}", "a".repeat(65))), None);
    }
}
