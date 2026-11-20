//! Number rules the engine's results share: how a value is rounded for the schedules,
//! which inputs count as given, and how a stored number is read.

use serde_json::Value;

/// `value` to `digits` decimals: the decimal nearest the stored `f64`, as `{:.N}` prints
/// it (an exact tie rounds to even). Non-finite values pass through.
pub fn round(value: f64, digits: usize) -> f64 {
    if !value.is_finite() {
        return value;
    }
    format!("{value:.digits$}").parse().unwrap_or(value)
}

/// A number in its shortest form (30, 2.5, 0.0245), never "-0".
pub fn display(value: f64) -> String {
    if value == 0.0 {
        "0".into()
    } else {
        value.to_string()
    }
}

/// A positive quantity, else none: an override or input left at 0, blank, or invalid.
pub fn positive(value: Option<f64>) -> Option<f64> {
    value.filter(|value| *value > 0.0)
}

/// A finite value, else 0 (a load with no VA yet).
pub fn finite_or_zero(value: f64) -> f64 {
    if value.is_finite() {
        value
    } else {
        0.0
    }
}

/// Non-empty text, else none.
pub fn text(value: Option<&str>) -> Option<&str> {
    value.filter(|text| !text.is_empty())
}

/// A number as a document stores it: a JSON number or numeric text ("400", " 2.5 ").
pub fn stored(value: Option<&Value>) -> Option<f64> {
    match value? {
        Value::Number(number) => number.as_f64(),
        Value::String(text) => text.trim().parse().ok(),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn rounds_to_the_nearest_decimal_of_the_stored_value() {
        assert_eq!(round(1.428_0, 3), 1.428);
        assert_eq!(round(4.162_525, 4), 4.1625);
        // 1.005 is stored as 1.00499999999999989…, so it rounds down.
        assert_eq!(round(1.005, 2), 1.0);
        assert_eq!(round(-2.345_67, 2), -2.35);
        assert!(round(f64::NAN, 2).is_nan());
    }

    #[test]
    fn displays_the_shortest_form() {
        assert_eq!(display(30.0), "30");
        assert_eq!(display(2.5), "2.5");
        assert_eq!(display(-0.0), "0");
    }

    #[test]
    fn only_positive_quantities_count_as_given() {
        assert_eq!(positive(Some(30.0)), Some(30.0));
        assert_eq!(positive(Some(0.0)), None);
        assert_eq!(positive(Some(-1.0)), None);
        assert_eq!(positive(Some(f64::NAN)), None);
        assert_eq!(positive(None), None);
    }

    #[test]
    fn reads_stored_numbers_and_numeric_text() {
        assert_eq!(stored(Some(&json!(400))), Some(400.0));
        assert_eq!(stored(Some(&json!(" 2.5 "))), Some(2.5));
        assert_eq!(stored(Some(&json!(""))), None);
        assert_eq!(stored(Some(&json!("abc"))), None);
        assert_eq!(stored(Some(&json!(null))), None);
        assert_eq!(stored(None), None);
    }
}
