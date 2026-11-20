//! Reader for legacy v1 `.heda` files, used once per file to upgrade it to v2/v3.
//!
//! v1 sealed files with CryptoJS: AES-CBC with an HMAC-SHA256 over the envelope, and a
//! PBKDF2-SHA256 key (1000 iterations). The HMAC and the later PBKDF2 rounds are standard
//! and come from the `hmac`/`sha2` crates. Two CryptoJS quirks are not, so they are ported
//! by hand from the TypeScript reader this replaces:
//! - the salt went through `Hex.parse`, so a non-hex or odd-length salt (a file name)
//!   becomes a message that is not whole bytes, which no crate hashes; only the first
//!   PBKDF2 round sees it (`first_round`), and only its padding is hand-written.
//! - the AES key was the 64-character hex string itself, which CryptoJS runs as a 512-bit,
//!   22-round AES that no crate implements (`Aes512`).
//!
//! shortcut: v1 support is temporary; delete this module (and the `legacy/` TS folder)
//! once v1 files no longer need upgrading.

use base64::alphabet::STANDARD;
use base64::engine::{DecodePaddingMode, GeneralPurpose, GeneralPurposeConfig};
use base64::Engine;
use hmac::{Hmac, Mac};
use sha2::Sha256;

pub const ITERATIONS: u32 = 1000;

type HmacSha256 = Hmac<Sha256>;

/// Why a v1 file did not open: `code` is one of `format`, `integrity`, `ciphertext`,
/// `payload` (the TS `LegacyV1Error` codes).
#[derive(Debug, PartialEq)]
pub struct Refusal {
    pub code: &'static str,
    pub message: &'static str,
}

const FORMAT: Refusal = Refusal {
    code: "format",
    message: "The legacy file envelope is not valid.",
};
const NO_SALTS: Refusal = Refusal {
    code: "format",
    message: "No legacy key candidates are available.",
};
const INTEGRITY: Refusal = Refusal {
    code: "integrity",
    message: "Legacy integrity check failed. The file may be damaged or use different legacy keys.",
};
const CIPHERTEXT: Refusal = Refusal {
    code: "ciphertext",
    message: "The legacy file could not be decrypted.",
};
const PAYLOAD: Refusal = Refusal {
    code: "payload",
    message: "The legacy file payload is not valid.",
};

/// The decrypted payload as JSON text (the app parses it, so its numbers stay exactly
/// what `JSON.parse` gave), and the salt that opened it.
#[derive(Debug)]
pub struct Plain {
    pub text: String,
    pub salt: String,
}

struct Envelope {
    iv: Vec<u8>,
    hmac: Vec<u8>,
    cipher: Vec<u8>,
    /// What the HMAC covers: the IV and ciphertext as written (base64).
    signed: String,
}

pub fn is_envelope(raw: &str) -> bool {
    decode_envelope(raw).is_ok()
}

/// Tries each salt in order; the first whose HMAC matches decides the outcome.
pub fn decrypt(raw: &str, passphrase: &str, salts: &[String]) -> Result<Plain, Refusal> {
    let envelope = decode_envelope(raw)?;
    let mut tried: Vec<&str> = Vec::new();
    for salt in salts {
        if salt.is_empty() || tried.contains(&salt.as_str()) {
            continue;
        }
        tried.push(salt);
        let key = derive_key_hex(passphrase, salt);
        let mut mac = HmacSha256::new_from_slice(key.as_bytes()).expect("HMAC takes any key");
        mac.update(envelope.signed.as_bytes());
        if mac.verify_slice(&envelope.hmac).is_err() {
            continue;
        }
        let plain = Aes512::new(key.as_bytes()).decrypt_cbc(&envelope.cipher, &envelope.iv)?;
        let text = String::from_utf8(plain).map_err(|_| PAYLOAD)?;
        // TextDecoder drops a leading byte order mark.
        let text = text.strip_prefix('\u{feff}').unwrap_or(&text).to_owned();
        return Ok(Plain {
            text,
            salt: salt.clone(),
        });
    }
    Err(if tried.is_empty() {
        NO_SALTS
    } else {
        INTEGRITY
    })
}

fn decode_envelope(raw: &str) -> Result<Envelope, Refusal> {
    let normalized: String = raw
        .trim_matches(is_js_space)
        .chars()
        .map(from_gibberish)
        .collect();
    // Older writes did not truncate, so only the first envelope counts.
    let mut parts = normalized.split(':');
    let (Some(iv64), Some(hmac64), Some(cipher64)) = (parts.next(), parts.next(), parts.next())
    else {
        return Err(FORMAT);
    };
    let (iv, hmac, cipher) = (base64(iv64)?, base64(hmac64)?, base64(cipher64)?);
    if iv.len() != 16 || hmac.len() != 32 || cipher.is_empty() || cipher.len() % 16 != 0 {
        return Err(FORMAT);
    }
    Ok(Envelope {
        iv,
        hmac,
        cipher,
        signed: format!("{iv64}{cipher64}"),
    })
}

/// `/^[A-Za-z0-9+/]+={0,2}$/` then `atob`, which takes `=` padding only on a whole quad
/// and ignores leftover bits.
fn base64(value: &str) -> Result<Vec<u8>, Refusal> {
    const ATOB: GeneralPurpose = GeneralPurpose::new(
        &STANDARD,
        GeneralPurposeConfig::new()
            .with_decode_padding_mode(DecodePaddingMode::Indifferent)
            .with_decode_allow_trailing_bits(true),
    );
    let body = value.trim_end_matches('=');
    let padding = value.len() - body.len();
    let alphabet = |b: u8| b.is_ascii_alphanumeric() || b == b'+' || b == b'/';
    if body.is_empty() || padding > 2 || !body.bytes().all(alphabet) {
        return Err(FORMAT);
    }
    if (padding > 0 && value.len() % 4 != 0) || body.len() % 4 == 1 {
        return Err(FORMAT);
    }
    ATOB.decode(body).map_err(|_| FORMAT)
}

/// v1 releases before 1.6 replaced these base64 characters with symbols.
fn from_gibberish(c: char) -> char {
    match c {
        '♜' => 'a',
        '♞' => 'B',
        '♝' => 'c',
        '♛' => 'D',
        '♚' => 'e',
        '♟' => 'F',
        '♖' => 'g',
        '♘' => 'H',
        '♗' => 'i',
        '♕' => 'J',
        '♔' => 'k',
        '♙' => 'L',
        '♠' => 'm',
        '♣' => 'N',
        '♥' => 'o',
        '♦' => 'P',
        '♪' => 'q',
        '♫' => 'R',
        '☼' => 's',
        '☾' => 'T',
        '☁' => 'u',
        '☂' => 'V',
        '☃' => 'w',
        '✘' => 'X',
        '✔' => 'y',
        '✦' => 'Z',
        '⓪' => '0',
        '②' => '2',
        '④' => '4',
        '⑥' => '6',
        '⑧' => '8',
        other => other,
    }
}

/// JavaScript's whitespace for `trim` and `parseInt` (WhiteSpace and LineTerminator),
/// which is not Rust's `char::is_whitespace`.
fn is_js_space(c: char) -> bool {
    matches!(
        c,
        '\t' | '\n' | '\u{b}' | '\u{c}' | '\r' | ' ' | '\u{a0}' | '\u{1680}' | '\u{2000}'
            ..='\u{200a}'
                | '\u{2028}'
                | '\u{2029}'
                | '\u{202f}'
                | '\u{205f}'
                | '\u{3000}'
                | '\u{feff}'
    )
}

/// The 64 lowercase hex characters of the PBKDF2-SHA256 key, as CryptoJS gave them.
fn derive_key_hex(passphrase: &str, salt: &str) -> String {
    let password = passphrase.as_bytes();
    let mac = HmacSha256::new_from_slice(password).expect("HMAC takes any key");
    let mut round = first_round(password, salt);
    let mut key = round;
    for _ in 1..ITERATIONS {
        round = mac
            .clone()
            .chain_update(round)
            .finalize()
            .into_bytes()
            .into();
        key.iter_mut().zip(round).for_each(|(k, r)| *k ^= r);
    }
    key.iter().map(|b| format!("{b:02x}")).collect()
}

/// PBKDF2's first round, `HMAC(password, Hex.parse(salt) || INT(1))`, through CryptoJS's
/// word arrays (big-endian words and a byte count an odd-length salt leaves at a half).
fn first_round(password: &[u8], salt: &str) -> [u8; 32] {
    let message = Words::hex_parse(salt).concat(&Words {
        words: vec![1],
        sig_bytes: 4.0,
    });
    let mut key = Words::from_bytes(password);
    if key.sig_bytes > 64.0 {
        key = Words::from_bytes(&key.sha256());
    }
    let pad = |fill: u32| {
        let mut words = key.words.clone();
        clamp(&mut words, key.sig_bytes);
        words.resize(words.len().max(16), 0);
        words.iter_mut().take(16).for_each(|w| *w ^= fill);
        Words {
            words,
            sig_bytes: 64.0,
        }
    };
    let inner = pad(0x3636_3636).concat(&message).sha256();
    pad(0x5c5c_5c5c).concat(&Words::from_bytes(&inner)).sha256()
}

/// A CryptoJS `WordArray`. Its arithmetic follows JavaScript's: shift counts go through
/// `ToUint32` and wrap at 32, and missing words read as 0.
struct Words {
    words: Vec<u32>,
    sig_bytes: f64,
}

impl Words {
    fn from_bytes(bytes: &[u8]) -> Self {
        let mut words = vec![0; bytes.len().div_ceil(4)];
        for (i, &byte) in bytes.iter().enumerate() {
            words[i / 4] |= u32::from(byte) << (24 - (i % 4) * 8);
        }
        Words {
            words,
            sig_bytes: bytes.len() as f64,
        }
    }

    /// `CryptoJS.enc.Hex.parse`: `parseInt(pair, 16)` per two UTF-16 units, NaN as 0.
    fn hex_parse(value: &str) -> Self {
        let units: Vec<u16> = value.encode_utf16().collect();
        let mut words = Vec::new();
        for i in (0..units.len()).step_by(2) {
            let pair = &units[i..(i + 2).min(units.len())];
            let parsed = parse_int_hex(pair).unwrap_or(0) as u32;
            or_at(
                &mut words,
                i >> 3,
                parsed.wrapping_shl(24 - (i % 8) as u32 * 4),
            );
        }
        Words {
            words,
            sig_bytes: units.len() as f64 / 2.0,
        }
    }

    fn get(&self, index: usize) -> u32 {
        self.words.get(index).copied().unwrap_or(0)
    }

    fn concat(&self, right: &Words) -> Words {
        let mut words = self.words.clone();
        clamp(&mut words, self.sig_bytes);
        if self.sig_bytes % 4.0 != 0.0 {
            let mut i = 0;
            while (i as f64) < right.sig_bytes {
                let byte = (right.get(i >> 2) >> (24 - (i % 4) * 8)) & 0xff;
                let at = self.sig_bytes + i as f64;
                let shift = to_uint32(24.0 - (at % 4.0) * 8.0);
                or_at(
                    &mut words,
                    (to_uint32(at) >> 2) as usize,
                    byte.wrapping_shl(shift),
                );
                i += 1;
            }
        } else {
            let mut i = 0;
            while (i as f64) < right.sig_bytes {
                let index = (to_uint32(self.sig_bytes + i as f64) >> 2) as usize;
                set_at(&mut words, index, right.get(i >> 2));
                i += 4;
            }
        }
        Words {
            words,
            sig_bytes: self.sig_bytes + right.sig_bytes,
        }
    }

    /// SHA-256 of `sig_bytes * 8` bits, padded as the TS reader did (it does not clamp, so
    /// stray bits past the end are hashed too) and compressed by `sha2`.
    fn sha256(&self) -> [u8; 32] {
        let mut words = self.words.clone();
        let bits = self.sig_bytes * 8.0;
        let end = (to_uint32(bits) >> 5) as usize;
        or_at(
            &mut words,
            end,
            0x80u32.wrapping_shl(to_uint32(24.0 - bits % 32.0)),
        );
        let length_index = (((to_uint32(bits + 64.0) >> 9) << 4) + 14) as usize;
        set_at(
            &mut words,
            length_index,
            (bits / 4_294_967_296.0).floor() as u32,
        );
        set_at(&mut words, length_index + 1, to_uint32(bits));
        words.resize(words.len().div_ceil(16) * 16, 0);
        let blocks: Vec<_> = words
            .chunks(16)
            .map(|block| {
                let bytes: Vec<u8> = block.iter().flat_map(|w| w.to_be_bytes()).collect();
                *sha2::digest::generic_array::GenericArray::from_slice(&bytes)
            })
            .collect();
        // FIPS 180-4 §5.3.3; `sha2` does not export its initial hash value.
        let mut state: [u32; 8] = [
            0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
            0x5be0cd19,
        ];
        sha2::compress256(&mut state, &blocks);
        let mut digest = [0; 32];
        for (chunk, word) in digest.chunks_mut(4).zip(state) {
            chunk.copy_from_slice(&word.to_be_bytes());
        }
        digest
    }
}

/// CryptoJS's `clamp`: keep `sig_bytes` bytes of the last word, drop the words after it.
fn clamp(words: &mut Vec<u32>, sig_bytes: f64) {
    let index = (to_uint32(sig_bytes) >> 2) as usize;
    let mask = 0xffff_ffffu32.wrapping_shl(to_uint32(32.0 - (sig_bytes % 4.0) * 8.0));
    set_at(words, index, words.get(index).copied().unwrap_or(0) & mask);
    words.resize((sig_bytes / 4.0).ceil() as usize, 0);
}

fn set_at(words: &mut Vec<u32>, index: usize, value: u32) {
    if words.len() <= index {
        words.resize(index + 1, 0);
    }
    words[index] = value;
}

fn or_at(words: &mut Vec<u32>, index: usize, value: u32) {
    let old = words.get(index).copied().unwrap_or(0);
    set_at(words, index, old | value);
}

/// JavaScript's `ToUint32` for the small finite values used here.
fn to_uint32(value: f64) -> u32 {
    (value.trunc() as i64).rem_euclid(1 << 32) as u32
}

/// `parseInt(units, 16)`: leading whitespace, a sign, an optional `0x`, then the longest
/// run of hex digits; `None` is NaN.
fn parse_int_hex(units: &[u16]) -> Option<i32> {
    let text = String::from_utf16_lossy(units);
    let text = text.trim_start_matches(is_js_space);
    let (sign, text) = match text.strip_prefix('-') {
        Some(rest) => (-1, rest),
        None => (1, text.strip_prefix('+').unwrap_or(text)),
    };
    let text = text
        .strip_prefix("0x")
        .or_else(|| text.strip_prefix("0X"))
        .unwrap_or(text);
    let digits: String = text.chars().take_while(char::is_ascii_hexdigit).collect();
    i32::from_str_radix(&digits, 16)
        .ok()
        .map(|value| sign * value)
}

/// CryptoJS AES with a 64-byte key: Nk = 16, so 22 rounds, decryption only.
struct Aes512 {
    rounds: usize,
    inverse: Vec<u32>,
}

struct Tables {
    sbox: [u8; 256],
    inv_sbox: [u8; 256],
    inv_mix: [[u32; 256]; 4],
}

const TABLES: Tables = build_tables();

/// The AES S-boxes and inverse MixColumns tables, built as CryptoJS builds them.
const fn build_tables() -> Tables {
    let mut doubles = [0u32; 256];
    let mut i = 0;
    while i < 256 {
        doubles[i] = if i < 128 {
            (i as u32) << 1
        } else {
            ((i as u32) << 1) ^ 0x11b
        };
        i += 1;
    }
    let mut tables = Tables {
        sbox: [0; 256],
        inv_sbox: [0; 256],
        inv_mix: [[0; 256]; 4],
    };
    let mut x = 0usize;
    let mut inverse = 0u32;
    let mut n = 0;
    while n < 256 {
        let mut sbox = inverse ^ (inverse << 1) ^ (inverse << 2) ^ (inverse << 3) ^ (inverse << 4);
        sbox = (sbox >> 8) ^ (sbox & 0xff) ^ 0x63;
        tables.sbox[x] = sbox as u8;
        tables.inv_sbox[sbox as usize] = x as u8;
        let x2 = doubles[x];
        let x4 = doubles[x2 as usize];
        let x8 = doubles[x4 as usize];
        let mix =
            (x8 * 0x0101_0101) ^ (x4 * 0x0001_0001) ^ (x2 * 0x0101) ^ (x as u32 * 0x0101_0100);
        let s = sbox as usize;
        tables.inv_mix[0][s] = mix.rotate_right(8);
        tables.inv_mix[1][s] = mix.rotate_right(16);
        tables.inv_mix[2][s] = mix.rotate_right(24);
        tables.inv_mix[3][s] = mix;
        if x == 0 {
            x = 1;
            inverse = 1;
        } else {
            x = (x2 ^ doubles[doubles[doubles[(x8 ^ x2) as usize] as usize] as usize]) as usize;
            inverse ^= doubles[doubles[inverse as usize] as usize];
        }
        n += 1;
    }
    tables
}

const RCON: [u32; 11] = [
    0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36,
];

impl Aes512 {
    /// The key schedule, then its equivalent-inverse form (FIPS 197 §5.3.5).
    fn new(key: &[u8]) -> Self {
        let t = &TABLES;
        let sub = |w: u32| u32::from_be_bytes(w.to_be_bytes().map(|b| t.sbox[b as usize]));
        let key_size = key.len() / 4;
        let rounds = key_size + 6;
        let rows = (rounds + 1) * 4;
        let mut schedule: Vec<u32> = key
            .chunks(4)
            .map(|c| u32::from_be_bytes(c.try_into().expect("4-byte chunk")))
            .collect();
        for row in key_size..rows {
            let mut value = schedule[row - 1];
            if row % key_size == 0 {
                value = sub(value.rotate_left(8)) ^ (RCON[row / key_size] << 24);
            } else if key_size > 6 && row % key_size == 4 {
                value = sub(value);
            }
            schedule.push(schedule[row - key_size] ^ value);
        }
        let inverse = (0..rows)
            .map(|inverse_row| {
                let row = rows - inverse_row;
                let value = schedule[if inverse_row % 4 != 0 { row } else { row - 4 }];
                if inverse_row < 4 || row <= 4 {
                    value
                } else {
                    let [a, b, c, d] = value.to_be_bytes().map(|b| t.sbox[b as usize] as usize);
                    t.inv_mix[0][a] ^ t.inv_mix[1][b] ^ t.inv_mix[2][c] ^ t.inv_mix[3][d]
                }
            })
            .collect();
        Aes512 { rounds, inverse }
    }

    fn decrypt_block(&self, block: [u32; 4]) -> [u32; 4] {
        let (t, k) = (&TABLES, &self.inverse);
        let byte = |w: u32, at: u32| ((w >> at) & 0xff) as usize;
        // CryptoJS swaps words 1 and 3 so decryption can reuse the encryption layout.
        let mut s = [
            block[0] ^ k[0],
            block[3] ^ k[1],
            block[2] ^ k[2],
            block[1] ^ k[3],
        ];
        let mut row = 4;
        for _ in 1..self.rounds {
            let mut next = [0; 4];
            for (i, word) in next.iter_mut().enumerate() {
                *word = t.inv_mix[0][byte(s[i], 24)]
                    ^ t.inv_mix[1][byte(s[(i + 1) % 4], 16)]
                    ^ t.inv_mix[2][byte(s[(i + 2) % 4], 8)]
                    ^ t.inv_mix[3][byte(s[(i + 3) % 4], 0)]
                    ^ k[row + i];
            }
            s = next;
            row += 4;
        }
        let mut out = [0; 4];
        for (i, word) in out.iter_mut().enumerate() {
            *word = u32::from_be_bytes([
                t.inv_sbox[byte(s[i], 24)],
                t.inv_sbox[byte(s[(i + 1) % 4], 16)],
                t.inv_sbox[byte(s[(i + 2) % 4], 8)],
                t.inv_sbox[byte(s[(i + 3) % 4], 0)],
            ]) ^ k[row + i];
        }
        [out[0], out[3], out[2], out[1]]
    }

    /// CBC with PKCS#7 padding.
    fn decrypt_cbc(&self, cipher: &[u8], iv: &[u8]) -> Result<Vec<u8>, Refusal> {
        let mut plain = Vec::with_capacity(cipher.len());
        let mut previous = iv;
        for block in cipher.chunks(16) {
            let words: [u32; 4] = std::array::from_fn(|i| {
                u32::from_be_bytes(block[i * 4..i * 4 + 4].try_into().expect("4 bytes"))
            });
            let decrypted = self.decrypt_block(words);
            let bytes = decrypted.iter().flat_map(|w| w.to_be_bytes());
            plain.extend(bytes.zip(previous).map(|(b, p)| b ^ p));
            previous = block;
        }
        let padding = *plain.last().ok_or(CIPHERTEXT)? as usize;
        if padding == 0 || padding > 16 || padding > plain.len() {
            return Err(CIPHERTEXT);
        }
        if plain[plain.len() - padding..]
            .iter()
            .any(|&b| b as usize != padding)
        {
            return Err(CIPHERTEXT);
        }
        plain.truncate(plain.len() - padding);
        Ok(plain)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Keys the TypeScript reader (CryptoJS port) derived for salts that hit every quirk:
    // odd lengths, non-hex pairs, signs, `0x`, whitespace, astral characters, and a
    // passphrase longer than the HMAC block.
    const SHORT: &str = "legacy-test-passphrase";
    const VECTORS: &[(bool, &str, &str)] = &[
        (
            false,
            "@legacy-test-salt",
            "1d2abe351624e117569d743f418d2b01fe2cbb22b8ea09759da282e8ea1fc5ff",
        ),
        (
            false,
            "Legacy Project",
            "9e764deb9a3b8746e0ef1b85ecb82507ab1b742d43454eab3df3aa7770e28269",
        ),
        (
            false,
            "a",
            "2d73d69b689f29da6f587b454f608187a27f7b8665283cf3f857ff5fae8ceb77",
        ),
        (
            false,
            "abc",
            "4faaa66f8f4a7f57246d03c1a53848035d8932b376c2a001eadcb378ee95718b",
        ),
        (
            false,
            "-a",
            "880bb70e4aada352134e82964c25e660ca7c7e870fcb08922800be8765070d44",
        ),
        (
            false,
            "+f0x1",
            "b00b550ddcc6433769951c6bc5755c256f03c73cbcaf477216928714155b41e8",
        ),
        (
            false,
            "0x",
            "7833f688cacc400331b38f5193a6dffc141af208f7249cbaa3695a529eb118dd",
        ),
        (
            false,
            " a",
            "c7acef7e4f4b647fc784ad8dbdc58ba027c44f6682e9d49e3ab99fa17cd52cf8",
        ),
        (
            false,
            "\ta1",
            "faf550eff5ee8c67a3d31526a07ca27dd569ee829c61c29d30fa39283d7b72cc",
        ),
        (
            false,
            "Panel (1)",
            "77a1f14fd63f7383c56e05a1a4de2c747a277c7e2be28f4ce25a12dcbb695126",
        ),
        (
            false,
            "Ünïcode ⚡",
            "b7e28755d7fff0a7d3243961d59d2e9c5c65ff5577312043d1c9a46c539151f7",
        ),
        (
            false,
            "😀x",
            "3a9f9937d64be8495f361773a3756d93a7ad6cadc830c20ca463f1ad0f7d919a",
        ),
        (
            false,
            "ff",
            "91180fc717d2c04d446f339a7ec9782c27c448e66ccbb339a927ee4b31a9c43b",
        ),
        (
            true,
            "@legacy-test-salt",
            "c646680742844dc9361185cec7b631541ab96ea9303d3b49adc2cd831ccc7766",
        ),
        (
            true,
            "Legacy Project",
            "aaf09f8f7332d9daf0365acffcc710bd067b7f68e46de4e3acfd434cddfa4d36",
        ),
        (
            true,
            "-a",
            "62d5f6ef46036b3643635d54fd8787e23e88ef8003ca4714435a65aefd08b273",
        ),
        (
            true,
            "+f0x1",
            "1921c7f1753c66c3e59a57e9c034bae430b27a456b4ef4195b585d701948957c",
        ),
        (
            true,
            "Ünïcode ⚡",
            "7a7efcafb6e9e0219107da6bbe4ed463976d9f9270ff765161262f05595ddea9",
        ),
        (
            true,
            "😀x",
            "b5bf9c1802455671f90edc6ea7c540d8aad055679b7afc080029bbb32f773e21",
        ),
    ];

    #[test]
    fn derives_the_keys_the_typescript_reader_derived() {
        let long = "p".repeat(70);
        for &(is_long, salt, expected) in VECTORS {
            let passphrase = if is_long { long.as_str() } else { SHORT };
            assert_eq!(derive_key_hex(passphrase, salt), expected, "salt {salt:?}");
        }
    }

    #[test]
    fn parses_hex_pairs_like_parse_int() {
        let parse = |s: &str| parse_int_hex(&s.encode_utf16().collect::<Vec<_>>());
        assert_eq!(parse("ff"), Some(255));
        assert_eq!(parse("1g"), Some(1));
        assert_eq!(parse("-a"), Some(-10));
        assert_eq!(parse(" a"), Some(10));
        assert_eq!(parse("0x"), None);
        assert_eq!(parse("g1"), None);
    }
}
