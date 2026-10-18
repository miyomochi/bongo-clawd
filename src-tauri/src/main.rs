#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod app;
mod input;
mod preferences;
mod protocol;
mod resources;
fn main() {
    app::run();
}
