//! The JavaScript surface of the WASM build, used by tests and browser development
//! (`src/lib/core/`). Production calls the same `dispatch` natively through Tauri.

use crate::dispatch::dispatch;
use crate::session::Session;
use std::cell::RefCell;
use wasm_bindgen::prelude::wasm_bindgen;

thread_local! {
    static SESSION: RefCell<Session> = RefCell::new(Session::default());
}

/// Runs one engine command; arguments and result are JSON text, as over Tauri's IPC.
#[wasm_bindgen]
pub fn dispatch_json(command: &str, args: &str) -> Result<String, String> {
    let args = serde_json::from_str(args).map_err(|error| format!("invalid JSON: {error}"))?;
    let result = SESSION.with(|session| dispatch(&mut session.borrow_mut(), command, args))?;
    serde_json::to_string(&result).map_err(|error| error.to_string())
}

/// Writes one engine file (`dispatch_file`); arguments are JSON text, the result its bytes.
#[wasm_bindgen]
pub fn dispatch_file(command: &str, args: &str) -> Result<Vec<u8>, String> {
    let args = serde_json::from_str(args).map_err(|error| format!("invalid JSON: {error}"))?;
    // As the app does: on a copy, so the session the other commands see is untouched.
    let mut copy = SESSION.with(|session| session.borrow().clone());
    crate::dispatch::dispatch_file(&mut copy, command, args)
}
