//! heda's calculation engine. Every electrical calculation lives in this crate; the
//! Svelte app only sends commands (`dispatch`) and renders what comes back.
//!
//! The crate is plain Rust: `cargo test` covers it natively, the Tauri backend links
//! it, and the `wasm` feature adds the bindings the app's tests and browser
//! development load (`src/lib/core/`).

pub mod bom;
pub mod catalog;
pub mod defaults;
pub mod dispatch;
pub mod edit;
pub mod graph;
pub mod js;
pub mod legacy_v1;
pub mod load_schedule;
pub mod migrate;
pub mod model;
pub mod phases;
pub mod riser;
pub mod riser_svg;
pub mod session;
pub mod sheet_set;
pub mod short_circuit;
pub mod sizing;
pub mod tables;
pub mod text;
pub mod voltage_drop;
#[cfg(feature = "wasm")]
mod wasm;
pub mod workbook;
