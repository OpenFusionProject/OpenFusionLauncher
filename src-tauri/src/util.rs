#![allow(dead_code)]

use std::path::PathBuf;

use dns_lookup::lookup_host;
use ffbuildtool::Version;
use log::*;

use crate::{state::get_app_statics, Result};

// for serde
pub fn true_fn() -> bool {
    true
}

// for serde
pub fn false_fn() -> bool {
    false
}

pub fn string_version_to_u32(version: &str) -> u32 {
    let mut version_parts = version.split('.').map(|part| part.parse::<u32>().unwrap());
    let major = version_parts.next().unwrap();
    let minor = version_parts.next().unwrap_or(0);
    let patch = version_parts.next().unwrap_or(0);
    (major << 16) | (minor << 8) | patch
}

pub fn get_timestamp() -> u64 {
    let now = std::time::SystemTime::now();
    now.duration_since(std::time::UNIX_EPOCH).unwrap().as_secs()
}

fn split_addr_port(addr_port: &str) -> Result<(String, u16)> {
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

fn resolve_host(host: &str) -> Result<String> {
    let addrs = lookup_host(host)?;
    for addr in addrs {
        if let std::net::IpAddr::V4(addr) = addr {
            return Ok(addr.to_string());
        }
    }
    Err(format!("No IPv4 address found for {}", host).into())
}

pub fn resolve_server_addr(addr: &str) -> Result<String> {
    let (host, port) = split_addr_port(addr)?;
    let Ok(ip) = resolve_host(&host) else {
        return Err(format!("Failed to resolve game server address {}", addr).into());
    };
    debug!("Resolved {} to {}", host, ip);
    Ok(format!("{}:{}", ip, port))
}

pub fn get_default_cache_dir() -> String {
    get_app_statics().ff_cache_dir.to_string_lossy().to_string()
}

pub fn get_default_offline_cache_dir() -> String {
    get_app_statics()
        .offline_cache_dir
        .to_string_lossy()
        .to_string()
}

pub fn get_cache_dir_for_version(base_cache_dir: &str, version: &Version) -> Result<PathBuf> {
    let cache_dir = PathBuf::from(base_cache_dir);
    let build_dir = cache_dir.join(version.get_uuid().to_string());
    Ok(build_dir)
}

pub fn get_dir_size(dir: &PathBuf) -> Result<u64> {
    let mut size = 0;
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let metadata = entry.metadata()?;
        if metadata.is_symlink() {
            continue;
        }
        if metadata.is_file() {
            size += metadata.len();
        } else if metadata.is_dir() {
            size += get_dir_size(&entry.path())?;
        }
    }
    Ok(size)
}

pub fn is_dir_empty(dir: &PathBuf) -> Result<bool> {
    match std::fs::read_dir(dir) {
        Ok(mut entries) => Ok(entries.next().is_none()),
        Err(e) => Err(e.into()),
    }
}

pub fn import_versions(to_import: Vec<Version>) -> Result<Vec<Version>> {
    let versions_path = get_app_statics().app_data_dir.join("versions");
    if !versions_path.exists() {
        std::fs::create_dir_all(&versions_path)?;
    }

    let mut versions = Vec::new();
    for version in to_import {
        let version_path = versions_path.join(format!("{}.json", version.get_uuid()));
        if let Err(e) = version.export_manifest(&version_path.to_string_lossy()) {
            warn!("Failed to import version: {}", e);
            continue;
        }
        debug!("Imported version to {}", version_path.to_string_lossy());
        versions.push(version);
    }
    Ok(versions)
}

pub async fn do_simple_get(url: &str) -> Result<String> {
    debug!("=> GET {}", url);
    let client = reqwest::Client::new();
    let response = client.get(url).send().await?;
    let text = response.text().await?;
    debug!("<= {}", text);
    Ok(text)
}
