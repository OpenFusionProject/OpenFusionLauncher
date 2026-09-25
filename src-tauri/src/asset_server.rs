use std::{
    io::Read,
    path::{Component, Path, PathBuf},
};

use log::*;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
};

const MAX_HEADER_SIZE: usize = 16 * 1024;
const FILE_READ_BUF_SIZE: usize = 64 * 1024;

/// Serves files from `root` over HTTP so Proton/Wine can fetch local
/// `file://` assets through the same loopback URL used for proxied CDN downloads.
pub async fn run(listener: TcpListener, root: PathBuf) {
    info!(
        "Local asset server listening on {} ({})",
        listener.local_addr().unwrap(),
        root.display()
    );

    loop {
        match listener.accept().await {
            Ok((stream, addr)) => {
                let root = root.clone();
                tokio::spawn(async move {
                    if let Err(e) = handle_client(stream, &root).await {
                        debug!("Local asset server error from {}: {}", addr, e);
                    }
                });
            }
            Err(e) => {
                error!("Local asset server accept error: {}", e);
            }
        }
    }
}

async fn handle_client(mut stream: TcpStream, root: &Path) -> std::io::Result<()> {
    let header_bytes = read_headers(&mut stream).await?;
    let header_text = String::from_utf8_lossy(&header_bytes);
    let request_line = header_text.lines().next().unwrap_or("");
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or("");
    let raw_path = parts.next().unwrap_or("/");

    if method != "GET" && method != "HEAD" {
        write_empty_response(&mut stream, "405 Method Not Allowed").await?;
        return Ok(());
    }

    let path_only = raw_path.split(['?', '#']).next().unwrap_or("/");
    let Some(file_path) = resolve_asset_path(root, path_only) else {
        write_empty_response(&mut stream, "400 Bad Request").await?;
        return Ok(());
    };

    let mut file = match std::fs::File::open(&file_path) {
        Ok(file) => file,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            debug!("Local asset not found: {}", file_path.display());
            write_empty_response(&mut stream, "404 Not Found").await?;
            return Ok(());
        }
        Err(e) => {
            warn!("Failed to open {}: {}", file_path.display(), e);
            write_empty_response(&mut stream, "500 Internal Server Error").await?;
            return Ok(());
        }
    };

    let metadata = file.metadata()?;
    if metadata.is_dir() {
        write_empty_response(&mut stream, "404 Not Found").await?;
        return Ok(());
    }

    let headers = format!(
        "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nContent-Type: application/octet-stream\r\nConnection: close\r\n\r\n",
        metadata.len()
    );
    stream.write_all(headers.as_bytes()).await?;

    if method == "GET" {
        let mut buf = vec![0u8; FILE_READ_BUF_SIZE];
        loop {
            let n = file.read(&mut buf)?;
            if n == 0 {
                break;
            }
            stream.write_all(&buf[..n]).await?;
        }
    }

    stream.shutdown().await.ok();
    Ok(())
}

async fn read_headers(stream: &mut TcpStream) -> std::io::Result<Vec<u8>> {
    let mut buf = Vec::new();
    let mut byte = [0u8; 1];
    while buf.len() < MAX_HEADER_SIZE {
        let n = stream.read(&mut byte).await?;
        if n == 0 {
            break;
        }
        buf.push(byte[0]);
        if buf.windows(4).any(|w| w == b"\r\n\r\n") || buf.windows(2).any(|w| w == b"\n\n") {
            return Ok(buf);
        }
    }
    if buf.is_empty() {
        Err(std::io::Error::new(
            std::io::ErrorKind::UnexpectedEof,
            "No data received",
        ))
    } else {
        Ok(buf)
    }
}

async fn write_empty_response(stream: &mut TcpStream, status: &str) -> std::io::Result<()> {
    let response = format!("HTTP/1.1 {status}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
    stream.write_all(response.as_bytes()).await?;
    stream.shutdown().await.ok();
    Ok(())
}

pub(crate) fn resolve_asset_path(root: &Path, request_path: &str) -> Option<PathBuf> {
    let trimmed = request_path.trim_start_matches('/');
    if trimmed.is_empty() {
        return None;
    }

    let decoded = percent_decode(trimmed);
    let relative = Path::new(&decoded);
    if relative.is_absolute()
        || relative
            .components()
            .any(|c| matches!(c, Component::ParentDir | Component::Prefix(_)))
    {
        return None;
    }

    Some(root.join(relative))
}

fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%'
            && i + 2 < bytes.len()
            && let Ok(value) =
                u8::from_str_radix(std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or(""), 16)
        {
            out.push(value);
            i += 3;
            continue;
        }
        if bytes[i] == b'+' {
            out.push(b' ');
            i += 1;
            continue;
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_rejects_parent_dir() {
        let root = Path::new("/tmp/assets");
        assert!(resolve_asset_path(root, "/../secret").is_none());
        assert!(resolve_asset_path(root, "/foo/../../secret").is_none());
    }

    #[test]
    fn resolve_joins_relative_name() {
        let root = PathBuf::from("assets");
        let path = resolve_asset_path(&root, "/Map_01_01.unity3d").unwrap();
        assert_eq!(path, root.join("Map_01_01.unity3d"));
    }

    #[test]
    fn resolve_decodes_percent_encoding() {
        let root = PathBuf::from("assets");
        let path = resolve_asset_path(&root, "/foo%20bar.unity3d").unwrap();
        assert_eq!(path, root.join("foo bar.unity3d"));
    }
}
