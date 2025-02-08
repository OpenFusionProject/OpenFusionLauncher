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
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct InfoResponse {
    pub api_version: String,
    pub secure_apis_enabled: bool,
    game_version: Option<String>,
    game_versions: Option<Vec<String>>,
    pub login_address: String,
    email_required: Option<bool>,
    pub custom_loading_screen: Option<bool>,
}
impl InfoResponse {
    pub fn get_supported_versions(&self) -> Vec<String> {
        if let Some(versions) = &self.game_versions {
            versions.clone()
        } else if let Some(version) = &self.game_version {
            vec![version.clone()]
        } else {
            vec![]
        }
    }
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

#[derive(Serialize, Deserialize)]
pub struct Session {
    username: String,
    session_token: String,
}

#[derive(Serialize)]
pub struct RegisterRequest {
    username: String,
    password: String,
    email: Option<String>,
}

#[derive(Serialize)]
pub struct RegisterResponse {
    resp: String,
    can_login: bool,
}

#[allow(dead_code)]
#[derive(Deserialize)]
pub struct CookieResponse {
    username: String,
    cookie: String,
    expires: u64,
}

fn make_api_error(url: &str, status: StatusCode, body: &str) -> Error {
    format!("API error {}: {} [{}]", status, body, url).into()
}

pub async fn get_info(endpoint_host: &str) -> Result<InfoResponse> {
    let info_json = util::do_simple_get(&format!("https://{}", endpoint_host)).await?;
    let info = serde_json::from_str(&info_json)?;
    Ok(info)
}

pub async fn get_announcements(endpoint_host: &str) -> Result<String> {
    let url = format!("https://{}/announcements.md", endpoint_host);
    let announcements = util::do_simple_get(&url).await?;
    Ok(announcements)
}

pub async fn get_status(endpoint_host: &str) -> Result<StatusResponse> {
    let status_json = util::do_simple_get(&format!("https://{}/status", endpoint_host)).await?;
    let status: StatusResponse = serde_json::from_str(&status_json)?;
    Ok(status)
}

pub async fn register_user(
    username: &str,
    password: &str,
    email: &str,
    endpoint_host: &str,
) -> Result<RegisterResponse> {
    debug!("Registering user {}", username);
    let req = RegisterRequest {
        username: username.to_string(),
        password: password.to_string(),
        email: if email.is_empty() {
            None
        } else {
            Some(email.to_string())
        },
    };
    let url = format!("https://{}/account/register", endpoint_host);
    let client = util::get_http_client();
    let res = client.post(&url).json(&req).send().await?;

    let status = res.status();
    let body = res.text().await?;
    if status.is_success() {
        Ok(RegisterResponse {
            resp: body,
            can_login: status == StatusCode::CREATED,
        })
    } else {
        Err(make_api_error(&url, status, &body))
    }
}

pub async fn get_refresh_token(
    username: &str,
    password: &str,
    endpoint_host: &str,
) -> Result<String> {
    debug!("Getting token for {}", username);
    let req = AuthRequest {
        username: username.to_string(),
        password: password.to_string(),
    };
    let url = format!("https://{}/auth", endpoint_host);
    let client = util::get_http_client();
    let res = client.post(&url).json(&req).send().await?;

    let status = res.status();
    let body = res.text().await?;
    if status.is_success() {
        Ok(body)
    } else {
        Err(make_api_error(&url, status, &body))
    }
}

pub async fn get_session(refresh_token: &str, endpoint_host: &str) -> Result<Session> {
    debug!("Getting session");
    let url = format!("https://{}/auth/session", endpoint_host);
    let client = util::get_http_client();
    let res = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", refresh_token))
        .send()
        .await?;

    let status = res.status();
    let body = res.text().await?;
    if status.is_success() {
        let session: Session = serde_json::from_str(&body)?;
        Ok(session)
    } else {
        Err(make_api_error(&url, status, &body))
    }
}

pub async fn get_cookie(token: &str, endpoint_host: &str) -> Result<(String, String)> {
    debug!("Getting cookie");
    let url = format!("https://{}/cookie", endpoint_host);
    let client = util::get_http_client();
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

    let time_now = util::get_timestamp();
    if cookie.expires < time_now {
        return Err("Cookie expired".into());
    }

    Ok((cookie.username, cookie.cookie))
}

// need to use std result here for future safety
async fn fetch_version_internal(
    endpoint_host: &str,
    filename: &str,
) -> std::result::Result<Version, String> {
    let version_endpoint = format!("https://{}/versions/{}", endpoint_host, filename);
    let version_json = util::do_simple_get(&version_endpoint)
        .await
        .map_err(|e| e.to_string())?;
    let version: Version = serde_json::from_str(&version_json).map_err(|e| e.to_string())?;
    Ok(version)
}

pub async fn fetch_version(endpoint_host: &str, version_uuid: Uuid) -> Result<Version> {
    debug!("Fetching version {}", version_uuid);
    let mut version = fetch_version_internal(endpoint_host, &version_uuid.to_string()).await;
    if version.is_err() {
        // try with .json extension
        version = fetch_version_internal(endpoint_host, &format!("{}.json", version_uuid)).await;
    }
    match version {
        Ok(v) => {
            if v.get_uuid() != version_uuid {
                return Err(
                    format!("Version mismatch: {} != {}", v.get_uuid(), version_uuid).into(),
                );
            }

            Ok(v)
        }
        Err(e) => {
            error!("Failed to fetch version {}: {}", version_uuid, e);
            Err(e.to_string().into())
        }
    }
}

pub async fn send_otp(endpoint_host: &str, email: &str) -> Result<()> {
    debug!("Sending OTP to {}", email);
    let url = format!("https://{}/account/otp", endpoint_host);
    let client = util::get_http_client();
    let res = client
        .post(&url)
        .json(&serde_json::json!({ "email": email }))
        .send()
        .await?;

    let status = res.status();
    let body = res.text().await?;
    if status.is_success() {
        Ok(())
    } else {
        Err(make_api_error(&url, status, &body))
    }
}
