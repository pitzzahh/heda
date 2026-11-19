//! heda's calculation engine. Every electrical calculation lives in this crate; the
//! Svelte app only sends commands (`dispatch`) and renders what comes back.
//!
//! The crate is plain Rust: `cargo test` covers it natively, the Tauri backend links
//! it, and the `wasm` feature adds the bindings the app's tests and browser
//! development load (`src/lib/core/`).

pub mod dispatch;
pub mod graph;
pub mod js;
pub mod load_schedule;
pub mod model;
pub mod phases;
pub mod session;
pub mod short_circuit;
pub mod sizing;
pub mod tables;
pub mod voltage_drop;
#[cfg(feature = "wasm")]
mod wasm;
