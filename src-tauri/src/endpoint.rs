use reqwest::StatusCode;
use serde::Deserialize;
use serde::Serialize;

use crate::Error;
use crate::Result;

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

fn make_api_error(status: StatusCode, body: &str) -> Error {
    format!("API error {}: {}", status, body).into()
}

pub async fn get_token(username: &str, password: &str, endpoint_host: &str) -> Result<String> {
    let req = AuthRequest {
        username: username.to_string(),
        password: password.to_string(),
    };

    let client = reqwest::Client::new();
    let res = client
        .post(format!("https://{}/auth", endpoint_host))
        .json(&req)
        .send()
        .await?;

    let status = res.status();
    let body = res.text().await?;
    if status.is_success() {
        Ok(body)
    } else {
        Err(make_api_error(status, &body))
    }
}

pub async fn get_cookie(token: &str, endpoint_host: &str) -> Result<String> {
    let client = reqwest::Client::new();
    let res = client
        .post(format!("https://{}/cookie", endpoint_host))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await?;

    let status = res.status();
    let body = res.text().await?;
    if !status.is_success() {
        return Err(make_api_error(status, &body));
    }
    let cookie: CookieResponse = serde_json::from_str(&body)?;
    Ok(cookie.cookie)
}
