// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    std::panic::set_hook(Box::new(|info| {
        log::error!("Panicked: {:?}", info);
    }));
    ffbuildtool::set_max_concurrent_downloads(10).unwrap();
    scamper::run();
}
