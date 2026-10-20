#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod app;
mod input;
mod preferences;
mod protocol;
mod resources;
mod statistics;
mod system;
mod updates;
mod update_service;
fn main() {
    app::run();
}
