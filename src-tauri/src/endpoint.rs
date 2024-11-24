use ffbuildtool::Version;
use log::*;
use reqwest::StatusCode;
use serde::Deserialize;
use serde::Serialize;
use uuid::Uuid;

use crate::util;
use crate::Error;
use crate::Result;

#[allow(dead_code)]
#[derive(Deserialize)]
pub struct InfoResponse {
    pub api_version: String,
    pub secure_apis_enabled: bool,
    pub game_version: String,
    pub login_address: String,
}

#[derive(Deserialize)]
pub struct StatusResponse {
    pub player_count: usize,
}

#[derive(Serialize)]
pub struct AuthRequest {
    username: String,
    password: String,
}

#[allow(dead_code)]
#[derive(Deserialize)]
pub struct CookieResponse {
    cookie: String,
    // we don't know what timezone the server is in so we can't check this,
    // but it should be valid at retrieval time
    expires: u64,
}

fn make_api_error(url: &str, status: StatusCode, body: &str) -> Error {
    format!("API error {}: {} [{}]", status, body, url).into()
}

pub async fn get_info(endpoint_host: &str) -> Result<InfoResponse> {
    let info_json = util::do_simple_get(&format!("https://{}", endpoint_host)).await?;
    let info: InfoResponse = serde_json::from_str(&info_json)?;
    Ok(info)
}

pub async fn get_status(endpoint_host: &str) -> Result<StatusResponse> {
    let status_json = util::do_simple_get(&format!("https://{}/status", endpoint_host)).await?;
    let status: StatusResponse = serde_json::from_str(&status_json)?;
    Ok(status)
}

pub async fn get_token(username: &str, password: &str, endpoint_host: &str) -> Result<String> {
    debug!("Getting token for {}", username);
    let req = AuthRequest {
        username: username.to_string(),
        password: password.to_string(),
    };
    let url = format!("https://{}/auth", endpoint_host);
    let client = reqwest::Client::new();
    let res = client.post(&url).json(&req).send().await?;

    let status = res.status();
    let body = res.text().await?;
    if status.is_success() {
        Ok(body)
    } else {
        Err(make_api_error(&url, status, &body))
    }
}

pub async fn get_cookie(token: &str, endpoint_host: &str) -> Result<String> {
    debug!("Getting cookie");
    let url = format!("https://{}/cookie", endpoint_host);
    let client = reqwest::Client::new();
    let res = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await?;

    let status = res.status();
    let body = res.text().await?;
    if !status.is_success() {
        return Err(make_api_error(&url, status, &body));
    }
    let cookie: CookieResponse = serde_json::from_str(&body)?;
    Ok(cookie.cookie)
}

pub async fn fetch_version(endpoint_host: &str, version_uuid: Uuid) -> Result<Version> {
    debug!("Fetching version {}", version_uuid);
    let version_endpoint = format!("https://{}/versions/{}", endpoint_host, version_uuid);
    let version_json = util::do_simple_get(&version_endpoint).await?;
    let version: Version = serde_json::from_str(&version_json)?;
    if version.get_uuid() != version_uuid {
        return Err(format!(
            "Version UUID mismatch: expected {}, got {}",
            version_uuid,
            version.get_uuid()
        )
        .into());
    }
    Ok(version)
}
