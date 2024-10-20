use dns_lookup::lookup_host;

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
    let mut parts = addr_port.split(':');
    let addr = parts.next().ok_or("Missing address")?.to_string();
    let port = parts.next().ok_or("Missing port")?.parse::<u16>()?;
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
