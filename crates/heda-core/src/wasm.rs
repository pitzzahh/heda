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

/// `Number(value.toFixed(digits))`, rounded exactly like JavaScript.
#[wasm_bindgen(js_name = roundJs)]
pub fn round_js(value: f64, digits: u32) -> f64 {
    crate::js::round_js(value, digits)
}

/// `value.toFixed(digits)`, rounded exactly like JavaScript.
#[wasm_bindgen(js_name = toFixedJs)]
pub fn to_fixed_js(value: f64, digits: u32) -> String {
    crate::js::to_fixed_js(value, digits)
}

/// `Number(text)`, parsed exactly like JavaScript.
#[wasm_bindgen(js_name = numberFromStr)]
pub fn number_from_str(text: &str) -> f64 {
    crate::js::number_from_str(text)
}

/// `Math.hypot(a, b)`, computed exactly like V8.
#[wasm_bindgen]
pub fn hypot(a: f64, b: f64) -> f64 {
    crate::js::hypot(a, b)
}
