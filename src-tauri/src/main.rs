// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(debug_assertions)]
    unsafe {
        std::env::set_var("OFL_DISABLE_STRICT_UPGRADE", "1");
    }

    ffbuildtool::set_max_concurrent_downloads(10).unwrap();
    scamper::run();
}
