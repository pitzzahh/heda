//! JavaScript number semantics the engine must reproduce exactly.
//!
//! heda's results were first defined by a TypeScript engine; the Rust engine has
//! to give the same numbers to the last bit (see `src/lib/core/golden.test.ts`),
//! so where JavaScript's built-ins differ from Rust's, the JavaScript behaviour is
//! ported here: `toFixed` rounding, `Number(string)` parsing and V8's
//! `Math.hypot`.
//!
//! ## `toFixed`
//!
//! `toFixed` rounds the exact binary value half away from zero (ECMA-262:
//! "If there are two such n, pick the larger n", applied to the magnitude).
//! Rust's `{:.N}` rounds an exact tie to even, so the rounding is done here on
//! the exact decimal expansion, which `{:.1100}` prints in full (every finite f64
//! has at most 1074 fractional digits).

/// Largest `digits` accepted, the limit of `toFixed` itself.
pub const MAX_DIGITS: u32 = 100;

/// `value.toFixed(digits)`, for values below 1e21 (from there `toFixed` prints in
/// exponent form, which this does not reimplement).
pub fn to_fixed_js(value: f64, digits: u32) -> String {
    assert!(
        digits <= MAX_DIGITS,
        "to_fixed_js: digits {digits} > {MAX_DIGITS}"
    );
    if value.is_nan() {
        return "NaN".to_owned();
    }
    if value.is_infinite() {
        return if value > 0.0 { "Infinity" } else { "-Infinity" }.to_owned();
    }
    if value.abs() >= 1e21 {
        // toFixed prints these like String(value), in exponent form; heda never
        // shows one, so refuse rather than reimplement Number::toString.
        panic!("to_fixed_js: {value} is outside the fixed-point range of toFixed");
    }
    // toFixed checks `x < 0`, which is false for -0, so -0 prints like 0.
    let sign = if value < 0.0 { "-" } else { "" };
    let precision = digits as usize;
    let exact = format!("{:.1100}", value.abs());
    let (whole, fraction) = exact
        .split_once('.')
        .expect("{:.N} with N > 0 always prints a point");
    // Digits kept: the whole part and `precision` fractional digits. Rounding up
    // is decided by the first dropped digit alone, which makes exact ties go up.
    let mut kept: Vec<u8> = whole
        .bytes()
        .chain(fraction.bytes().take(precision))
        .map(|byte| byte - b'0')
        .collect();
    if fraction.as_bytes()[precision] >= b'5' {
        increment(&mut kept);
    }
    let text: String = kept.iter().map(|digit| char::from(b'0' + digit)).collect();
    let (whole, fraction) = text.split_at(text.len() - precision);
    if precision == 0 {
        format!("{sign}{whole}")
    } else {
        format!("{sign}{whole}.{fraction}")
    }
}

/// Adds one to a decimal number held as digits, most significant first.
fn increment(digits: &mut Vec<u8>) {
    for digit in digits.iter_mut().rev() {
        if *digit < 9 {
            *digit += 1;
            return;
        }
        *digit = 0;
    }
    digits.insert(0, 1);
}

/// `Number(value.toFixed(digits))`. NaN, infinities and values from 1e21 up come
/// back unchanged, as they do from that expression in JavaScript.
pub fn round_js(value: f64, digits: u32) -> f64 {
    if !value.is_finite() || value.abs() >= 1e21 {
        return value;
    }
    to_fixed_js(value, digits)
        .parse()
        .expect("to_fixed_js always prints a parseable number")
}

/// `Number(text)`: ECMA-262 StringToNumber. Surrounding white space is
/// ignored, an empty string is 0, `0x`/`0o`/`0b` prefixes are integers, and
/// anything else that is not a decimal literal is NaN. Rust's parser is only
/// used on text this function has already matched against the decimal grammar,
/// because it also accepts words JavaScript rejects (`inf`, `nan`).
pub fn number_from_str(text: &str) -> f64 {
    let text = text.trim_matches(is_js_whitespace);
    if text.is_empty() {
        return 0.0;
    }
    for (prefix, radix) in [
        ("0x", 16),
        ("0X", 16),
        ("0o", 8),
        ("0O", 8),
        ("0b", 2),
        ("0B", 2),
    ] {
        if let Some(digits) = text.strip_prefix(prefix) {
            return integer_in_radix(digits, radix);
        }
    }
    let unsigned = text.strip_prefix(['+', '-']).unwrap_or(text);
    if unsigned == "Infinity" {
        return if text.starts_with('-') {
            f64::NEG_INFINITY
        } else {
            f64::INFINITY
        };
    }
    if !is_unsigned_decimal_literal(unsigned) {
        return f64::NAN;
    }
    text.parse().unwrap_or(f64::NAN)
}

/// ECMA-262 WhiteSpace and LineTerminator code points.
fn is_js_whitespace(c: char) -> bool {
    matches!(
        c,
        '\u{9}'
            | '\u{B}'
            | '\u{C}'
            | '\u{20}'
            | '\u{A0}'
            | '\u{FEFF}'
            | '\u{A}'
            | '\u{D}'
            | '\u{2028}'
            | '\u{2029}'
    ) || (c.is_whitespace() && !c.is_ascii())
}

/// StrUnsignedDecimalLiteral: `1`, `1.`, `.5`, `1.5e-3`; at least one digit before the exponent.
fn is_unsigned_decimal_literal(text: &str) -> bool {
    let (mantissa, exponent) = match text.find(['e', 'E']) {
        Some(index) => (&text[..index], Some(&text[index + 1..])),
        None => (text, None),
    };
    let (whole, fraction) = match mantissa.split_once('.') {
        Some((whole, fraction)) => (whole, fraction),
        None => (mantissa, ""),
    };
    let digits = |part: &str| part.bytes().all(|byte| byte.is_ascii_digit());
    let mantissa_ok =
        digits(whole) && digits(fraction) && !(whole.is_empty() && fraction.is_empty());
    let exponent_ok = exponent.is_none_or(|exponent| {
        let exponent = exponent.strip_prefix(['+', '-']).unwrap_or(exponent);
        !exponent.is_empty() && digits(exponent)
    });
    mantissa_ok && exponent_ok
}

fn integer_in_radix(digits: &str, radix: u32) -> f64 {
    if digits.is_empty() {
        return f64::NAN;
    }
    // shortcut: accumulates in f64, exact up to 2^53; heda never stores larger hex.
    digits
        .chars()
        .try_fold(0.0_f64, |total, c| {
            c.to_digit(radix)
                .map(|digit| total * f64::from(radix) + f64::from(digit))
        })
        .unwrap_or(f64::NAN)
}

/// `Number(value)` for a stored JSON value; `None` is `undefined` (NaN).
// shortcut: arrays and objects read as NaN; JavaScript would convert them through
// their string form, but no stored numeric field ever holds one.
pub fn number(value: Option<&serde_json::Value>) -> f64 {
    use serde_json::Value;
    match value {
        None => f64::NAN,
        Some(Value::Null) => 0.0,
        Some(Value::Bool(flag)) => f64::from(u8::from(*flag)),
        Some(Value::Number(number)) => number.as_f64().unwrap_or(f64::NAN),
        Some(Value::String(text)) => number_from_str(text),
        Some(Value::Array(_) | Value::Object(_)) => f64::NAN,
    }
}

/// Whether JavaScript treats the number as truthy (`0`, `-0` and NaN are falsy).
pub fn truthy(value: f64) -> bool {
    value != 0.0 && !value.is_nan()
}

/// `value || fallback` for an optional number.
pub fn or(value: Option<f64>, fallback: f64) -> f64 {
    match value {
        Some(value) if truthy(value) => value,
        _ => fallback,
    }
}

/// `value || fallback` for an optional string (the empty string is falsy).
pub fn or_str<'a>(value: Option<&'a str>, fallback: &'a str) -> &'a str {
    match value {
        Some(value) if !value.is_empty() => value,
        _ => fallback,
    }
}

/// `Math.max(a, b)`: NaN if either is NaN (Rust's `f64::max` would drop it).
pub fn max(a: f64, b: f64) -> f64 {
    if a.is_nan() || b.is_nan() {
        f64::NAN
    } else {
        a.max(b)
    }
}

/// `Math.hypot(a, b)` exactly as V8 computes it (`MathHypot` in V8's
/// `builtins/math.tq`): scale by the largest magnitude, then Kahan-sum the
/// squares. A plain `(a² + b²).sqrt()` or `f64::hypot` differs in the last bit
/// for a large share of inputs, which would move fault currents.
pub fn hypot(a: f64, b: f64) -> f64 {
    let values = [a.abs(), b.abs()];
    if values.iter().any(|value| value.is_infinite()) {
        return f64::INFINITY;
    }
    if values.iter().any(|value| value.is_nan()) {
        return f64::NAN;
    }
    let max = values[0].max(values[1]);
    if max == 0.0 {
        return 0.0;
    }
    let mut sum = 0.0_f64;
    let mut compensation = 0.0_f64;
    for value in values {
        let scaled = value / max;
        let summand = scaled * scaled - compensation;
        let preliminary = sum + summand;
        compensation = (preliminary - sum) - summand;
        sum = preliminary;
    }
    sum.sqrt() * max
}

/// `String(value)` for a number (ECMAScript Number::toString), from ryu-js (boa-dev):
/// shortest round-trip digits, exponent form below 1e-6 and from 1e21, `NaN`/`Infinity`.
pub fn number_to_string(value: f64) -> String {
    ryu_js::Buffer::new().format(value).to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn number_to_string_follows_js_string() {
        // Expected values are what `String(value)` returns in V8.
        for (value, js) in [
            (0.0, "0"),
            (-0.0, "0"),
            (1.0, "1"),
            (-1.0, "-1"),
            (3.5, "3.5"),
            (0.1 + 0.2, "0.30000000000000004"),
            (123456.789, "123456.789"),
            (100.0, "100"),
            (1e20, "100000000000000000000"),
            (1e21, "1e+21"),
            (1.5e21, "1.5e+21"),
            (0.000001, "0.000001"),
            (1e-7, "1e-7"),
            (-1.25e-7, "-1.25e-7"),
            (f64::NAN, "NaN"),
            (f64::INFINITY, "Infinity"),
            (f64::NEG_INFINITY, "-Infinity"),
        ] {
            assert_eq!(number_to_string(value), js, "{value:?}");
        }
    }

    #[test]
    fn number_from_str_follows_string_to_number() {
        // Expected values are what `Number(text)` returns.
        assert_eq!(number_from_str("12"), 12.0);
        assert_eq!(number_from_str(" 12\n"), 12.0);
        assert_eq!(number_from_str(""), 0.0);
        assert_eq!(number_from_str("   "), 0.0);
        assert_eq!(number_from_str("1."), 1.0);
        assert_eq!(number_from_str(".5"), 0.5);
        assert_eq!(number_from_str("-1.5e3"), -1500.0);
        assert_eq!(number_from_str("+2"), 2.0);
        assert_eq!(number_from_str("0x1F"), 31.0);
        assert_eq!(number_from_str("0b101"), 5.0);
        assert_eq!(number_from_str("Infinity"), f64::INFINITY);
        assert_eq!(number_from_str("-Infinity"), f64::NEG_INFINITY);
        for not_a_number in [
            "1/2", "abc", "inf", "nan", "NaN", "1e", ".", "-0x10", "1_000", "1,5", "e5",
        ] {
            assert!(number_from_str(not_a_number).is_nan(), "{not_a_number:?}");
        }
    }

    #[test]
    fn hypot_follows_v8() {
        // Pythagorean triples are exact in every implementation.
        assert_eq!(hypot(3.0, 4.0), 5.0);
        assert_eq!(hypot(-5.0, 12.0), 13.0);
        assert_eq!(hypot(0.0, 0.0), 0.0);
        assert_eq!(hypot(f64::NAN, f64::INFINITY), f64::INFINITY);
        assert!(hypot(f64::NAN, 1.0).is_nan());
        // `node -p "Math.hypot(1.2, 0.05)"` (PEC Table 10.1.1.9, 5.5 mm² in PVC: R and XL).
        assert_eq!(hypot(1.2, 0.05), 1.2010412149464313);
    }

    // Expected strings are what `node -p "(x).toFixed(n)"` prints.

    #[test]
    fn exact_ties_round_away_from_zero_like_to_fixed() {
        assert_eq!(to_fixed_js(2.5, 0), "3");
        assert_eq!(to_fixed_js(0.5, 0), "1");
        assert_eq!(to_fixed_js(1.5, 0), "2");
        assert_eq!(to_fixed_js(0.125, 2), "0.13");
        assert_eq!(to_fixed_js(0.375, 2), "0.38");
        assert_eq!(to_fixed_js(-2.5, 0), "-3");
        assert_eq!(to_fixed_js(-0.125, 2), "-0.13");
        // A carry out of the last kept digit reaches the whole part.
        assert_eq!(to_fixed_js(9.996, 2), "10.00");
        assert_eq!(to_fixed_js(99.5, 0), "100");
        assert_eq!(to_fixed_js(1234.0625, 3), "1234.063");
    }

    #[test]
    fn rust_rounds_those_ties_to_even_which_is_why_this_exists() {
        assert_eq!(format!("{:.0}", 2.5), "2");
        assert_eq!(format!("{:.2}", 0.125), "0.12");
    }

    #[test]
    fn non_ties_follow_the_exact_binary_value() {
        // 1.005 is stored as 1.00499999999999989…, so both languages print 1.00.
        assert_eq!(to_fixed_js(1.005, 2), "1.00");
        // 0.615 is stored as 0.61499999999999999…, below the tie.
        assert_eq!(to_fixed_js(0.615, 2), "0.61");
        assert_eq!(to_fixed_js(8.345, 2), "8.35");
        assert_eq!(to_fixed_js(98.765_432_1, 4), "98.7654");
        assert_eq!(to_fixed_js(10.0, 2), "10.00");
        assert_eq!(to_fixed_js(0.000_04, 4), "0.0000");
        assert_eq!(to_fixed_js(0.000_06, 4), "0.0001");
    }

    #[test]
    fn zero_and_negative_zero() {
        assert_eq!(to_fixed_js(0.0, 2), "0.00");
        assert_eq!(to_fixed_js(-0.0, 2), "0.00");
        assert_eq!(to_fixed_js(-0.001, 2), "-0.00");
        assert_eq!(round_js(-0.001, 2), 0.0);
    }

    #[test]
    fn round_js_parses_the_printed_value() {
        assert_eq!(round_js(0.125, 2), 0.13);
        assert_eq!(round_js(46.087_0, 2), 46.09);
        assert_eq!(round_js(2.0 / 3.0, 4), 0.6667);
    }

    #[test]
    #[should_panic(expected = "outside the fixed-point range")]
    fn refuses_values_to_fixed_prints_in_exponent_form() {
        to_fixed_js(1e21, 2);
    }

    #[test]
    fn non_finite_values_print_like_javascript() {
        assert_eq!(to_fixed_js(f64::NAN, 2), "NaN");
        assert_eq!(to_fixed_js(f64::INFINITY, 2), "Infinity");
        assert_eq!(to_fixed_js(f64::NEG_INFINITY, 4), "-Infinity");
        assert!(round_js(f64::NAN, 2).is_nan());
        assert_eq!(round_js(f64::INFINITY, 2), f64::INFINITY);
        assert_eq!(round_js(1e21, 2), 1e21);
    }

    #[test]
    fn falsy_numbers_and_strings() {
        assert_eq!(or(Some(0.0), 30.0), 30.0);
        assert_eq!(or(Some(-0.0), 30.0), 30.0);
        assert_eq!(or(Some(f64::NAN), 30.0), 30.0);
        assert_eq!(or(None, 30.0), 30.0);
        assert_eq!(or(Some(20.0), 30.0), 20.0);
        assert_eq!(or_str(Some(""), "x"), "x");
        assert_eq!(or_str(Some("a"), "x"), "a");
        assert!(max(1.0, f64::NAN).is_nan());
    }

    #[test]
    fn number_of_stored_values() {
        use serde_json::json;
        assert!(number(None).is_nan());
        assert_eq!(number(Some(&json!(null))), 0.0);
        assert_eq!(number(Some(&json!(true))), 1.0);
        assert_eq!(number(Some(&json!(12.5))), 12.5);
        assert_eq!(number(Some(&json!("10"))), 10.0);
        assert_eq!(number(Some(&json!(""))), 0.0);
        assert!(number(Some(&json!("1/2"))).is_nan());
    }
}
