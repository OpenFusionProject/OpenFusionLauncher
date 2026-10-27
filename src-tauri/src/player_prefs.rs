use std::{collections::HashMap, path::Path};

const MAGIC: &[u8; 8] = b"UnityPrf";

#[derive(Debug)]
pub(crate) enum Pref {
    String(String),
    Bool(bool),
    Int(i32),
    Float(f32),
}

#[derive(Debug)]
pub(crate) struct PlayerPrefs {
    major_version: u16,
    minor_version: u16,
    max_size: u32,
    pub values: HashMap<String, Pref>,
}

impl PlayerPrefs {
    pub fn load(path: &Path) -> Result<Self, String> {
        let bytes = std::fs::read(path).map_err(|e| format!("Failed to read file: {}", e))?;
        let mut offset = 0;
        let magic = read_n(&bytes, &mut offset, MAGIC.len())?;
        if magic != MAGIC {
            return Err("Invalid Unity PlayerPrefs file".into());
        }

        let minor_version = read_u16(&bytes, &mut offset)?;
        let major_version = read_u16(&bytes, &mut offset)?;
        let max_size = read_u32(&bytes, &mut offset)?;

        let mut values = HashMap::new();
        while let Ok(Pref::String(pref_name)) = read_pref(&bytes, &mut offset) {
            let pref_value = read_pref(&bytes, &mut offset)?;
            values.insert(pref_name, pref_value);
        }

        Ok(Self {
            major_version,
            minor_version,
            max_size,
            values,
        })
    }

    pub fn save(self, path: &Path) -> Result<(), String> {
        let mut bytes = Vec::with_capacity(self.max_size as usize);
        bytes.extend_from_slice(MAGIC);
        bytes.extend_from_slice(&self.minor_version.to_le_bytes());
        bytes.extend_from_slice(&self.major_version.to_le_bytes());
        bytes.extend_from_slice(&self.max_size.to_le_bytes());

        for (key, value) in self.values {
            write_pref(&mut bytes, &Pref::String(key))?;
            write_pref(&mut bytes, &value)?;
        }

        if bytes.len() > self.max_size as usize {
            return Err(format!(
                "PlayerPrefs size {} exceeded max size of {}",
                bytes.len(),
                self.max_size
            ));
        }

        std::fs::write(path, bytes).map_err(|e| format!("Failed to write file: {}", e))?;
        Ok(())
    }
}

fn read_n<'a>(bytes: &'a [u8], offset: &mut usize, n: usize) -> Result<&'a [u8], String> {
    if *offset + n > bytes.len() {
        return Err("Unexpected end of file".into());
    }
    let result = &bytes[*offset..*offset + n];
    *offset += n;
    Ok(result)
}

fn read_u8(bytes: &[u8], offset: &mut usize) -> Result<u8, String> {
    Ok(read_n(bytes, offset, 1)?[0])
}

fn read_u16(bytes: &[u8], offset: &mut usize) -> Result<u16, String> {
    Ok(u16::from_le_bytes(
        read_n(bytes, offset, 2)?
            .try_into()
            .map_err(|_| "Failed to read u16")?,
    ))
}

fn read_u32(bytes: &[u8], offset: &mut usize) -> Result<u32, String> {
    Ok(u32::from_le_bytes(
        read_n(bytes, offset, 4)?
            .try_into()
            .map_err(|_| "Failed to read u32")?,
    ))
}

fn read_string(bytes: &[u8], offset: &mut usize, length: usize) -> Result<String, String> {
    let string_bytes = read_n(bytes, offset, length)?;
    let string = std::str::from_utf8(string_bytes).map_err(|_| "Failed to read string")?;
    Ok(string.to_string())
}

fn read_pref(bytes: &[u8], offset: &mut usize) -> Result<Pref, String> {
    let pref_type = read_u8(bytes, offset)?;
    match pref_type {
        254 => {
            let value = read_u32(bytes, offset)? as i32;
            Ok(Pref::Int(value))
        }
        253 => {
            let value = read_u32(bytes, offset)?;
            Ok(Pref::Float(f32::from_bits(value)))
        }
        (0..=128) => {
            let length = if pref_type == 128 {
                read_u32(bytes, offset)? as usize
            } else {
                pref_type as usize
            };

            let value = read_string(bytes, offset, length)?;

            // Bools are stored in string form
            if value == "true" || value == "false" {
                return Ok(Pref::Bool(value == "true"));
            }

            Ok(Pref::String(value))
        }
        _ => Err("Unknown pref type".into()),
    }
}

fn write_pref(bytes: &mut Vec<u8>, pref: &Pref) -> Result<(), String> {
    match pref {
        Pref::Int(value) => {
            bytes.push(254);
            bytes.extend_from_slice(&(*value as u32).to_le_bytes());
        }
        Pref::Float(value) => {
            bytes.push(253);
            bytes.extend_from_slice(&value.to_bits().to_le_bytes());
        }
        Pref::String(value) => {
            let length = value.len();
            if length < 128 {
                bytes.push(length as u8);
            } else {
                bytes.push(128);
                bytes.extend_from_slice(&(length as u32).to_le_bytes());
            }
            bytes.extend_from_slice(value.as_bytes());
        }
        Pref::Bool(value) => {
            let s = if *value { "true" } else { "false" };
            write_pref(bytes, &Pref::String(s.to_string()))?;
        }
    }
    Ok(())
}
