// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(debug_assertions)]
    unsafe {
        std::env::set_var("OFL_DISABLE_STRICT_UPGRADE", "1");
    }

    // On Linux systems with proprietary NVIDIA drivers, DMA rendering may be borked.
    // Play it safe by disabling DMA buffer renderer if the proprietary NVIDIA module is loaded.
    #[cfg(target_os = "linux")]
    {
        use std::path::Path;
        const DISABLE_DMABUF_VAR: &str = "WEBKIT_DISABLE_DMABUF_RENDERER";
        if Path::new("/sys/module/nvidia").exists()
            && std::env::var_os(DISABLE_DMABUF_VAR).is_none()
        {
            unsafe {
                std::env::set_var(DISABLE_DMABUF_VAR, "1");
            }
        }
    }

    ffbuildtool::set_max_concurrent_downloads(10).unwrap();
    scamper::run();
}
