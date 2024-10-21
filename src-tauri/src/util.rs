use std::path::Path;

use dns_lookup::lookup_host;
use fs_extra::dir::CopyOptions;
use log::*;

use crate::Result;

// for serde
pub fn true_fn() -> bool {
    true
}

// for serde
pub fn false_fn() -> bool {
    false
}

pub fn version_zero() -> String {
    "0.0.0".to_string()
}

pub fn string_version_to_u32(version: &str) -> u32 {
    let mut version_parts = version.split('.').map(|part| part.parse::<u32>().unwrap());
    let major = version_parts.next().unwrap();
    let minor = version_parts.next().unwrap_or(0);
    let patch = version_parts.next().unwrap_or(0);
    (major << 16) | (minor << 8) | patch
}

pub fn split_addr_port(addr_port: &str) -> Result<(String, u16)> {
    const DEFAULT_PORT: u16 = 23000;
    let mut parts = addr_port.split(':');
    let addr = parts.next().ok_or("Missing address")?.to_string();
    let port = if let Some(port) = parts.next() {
        port.parse::<u16>()?
    } else {
        DEFAULT_PORT
    };
    Ok((addr, port))
}

pub fn resolve_host(host: &str) -> Result<String> {
    let addrs = lookup_host(host)?;
    for addr in addrs {
        if let std::net::IpAddr::V4(addr) = addr {
            return Ok(addr.to_string());
        }
    }
    Err(format!("No IPv4 address found for {}", host).into())
}

pub fn copy_resources(resource_dir: &Path, app_data_dir: &Path) -> Result<()> {
    const COPY_OPTIONS: CopyOptions = CopyOptions {
        overwrite: true,
        skip_exist: false,
        buffer_size: 64 * 1024,
        content_only: true,
        copy_inside: true,
        depth: 0,
    };

    info!("Copying resources");

    // assets
    let assets_src = resource_dir.join("assets");
    let assets_dst = app_data_dir.join("assets");
    fs_extra::dir::copy(assets_src, assets_dst, &COPY_OPTIONS)?;

    Ok(())
}
