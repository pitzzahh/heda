//! Text measuring with the embedded Liberation Sans (SIL Open Font License, `fonts/`),
//! metric-compatible with Arial, the font the riser SVG names. The sheet set PDF draws
//! with it, and the riser layout wraps its box lines by it.

use skrifa::instance::{LocationRef, Size};
use skrifa::metrics::GlyphMetrics;
use skrifa::{FontRef, MetadataProvider};

pub(crate) const REGULAR: &[u8] = include_bytes!("../fonts/LiberationSans-Regular.ttf");
pub(crate) const BOLD: &[u8] = include_bytes!("../fonts/LiberationSans-Bold.ttf");

/// Advance widths of the embedded fonts, to centre, fit and wrap text.
pub struct Metrics {
    pub(crate) regular: (FontRef<'static>, GlyphMetrics<'static>),
    pub(crate) bold: (FontRef<'static>, GlyphMetrics<'static>),
}

impl Default for Metrics {
    fn default() -> Self {
        Self::new()
    }
}

impl Metrics {
    pub fn new() -> Self {
        let load = |data: &'static [u8]| {
            let font = FontRef::new(data).expect("bundled font");
            let metrics = font.glyph_metrics(Size::new(1.0), LocationRef::default());
            (font, metrics)
        };
        Metrics {
            regular: load(REGULAR),
            bold: load(BOLD),
        }
    }

    /// Width of `text` at `size`, in the size's unit.
    pub fn width(&self, text: &str, size: f64, bold: bool) -> f64 {
        let (font, metrics) = if bold { &self.bold } else { &self.regular };
        let charmap = font.charmap();
        let em: f32 = text
            .chars()
            // Same glyphs as the PDF draws: an unmapped character is .notdef (glyph 0).
            .filter_map(|c| metrics.advance_width(charmap.map(c).unwrap_or_default()))
            .sum();
        f64::from(em) * size
    }

    /// Splits `text` into lines that fit `width` at `size`, between words. A word wider
    /// than `width` keeps a line of its own.
    pub(crate) fn wrap(&self, text: &str, width: f64, size: f64, bold: bool) -> Vec<String> {
        self.wrap_at(text, " ", width, size, bold)
    }

    /// Like [`Metrics::wrap`], but breaks a comma-separated list between its items first
    /// ("1 × 150 AT, 2 × 125 AT"), and only within an item that alone is too wide.
    pub(crate) fn wrap_list(&self, text: &str, width: f64, size: f64, bold: bool) -> Vec<String> {
        self.wrap_at(text, ", ", width, size, bold)
            .into_iter()
            .flat_map(|line| self.wrap(&line, width, size, bold))
            .collect()
    }

    fn wrap_at(&self, text: &str, sep: &str, width: f64, size: f64, bold: bool) -> Vec<String> {
        let mut lines = vec![];
        let mut line = String::new();
        let trail = sep.trim_end();
        for word in text.split(sep) {
            let next = if line.is_empty() {
                word.to_string()
            } else {
                format!("{line}{sep}{word}")
            };
            if !line.is_empty() && self.width(&next, size, bold) > width {
                // A list keeps its comma at the end of the broken line.
                lines.push(std::mem::replace(&mut line, word.to_string()) + trail);
            } else {
                line = next;
            }
        }
        if !line.is_empty() {
            lines.push(line);
        }
        lines
    }
}

#[cfg(test)]
mod tests {
    use super::Metrics;

    #[test]
    fn wraps_a_list_between_items_and_keeps_each_line_inside() {
        let m = Metrics::new();
        let text = "1 × 150 AT, 2 × 125 AT, 1 × 90 AT, 1 × 50 AT";
        let lines = m.wrap_list(text, 216.0, 12.0, false);
        assert!(lines.len() > 1, "{lines:?}");
        assert!(lines.iter().all(|l| m.width(l, 12.0, false) <= 216.0));
        // Nothing lost or reordered: the lines join back into the list.
        assert_eq!(lines.join(" "), text);
        assert!(lines[0].ends_with(','));
    }

    #[test]
    fn a_short_line_stays_whole_and_a_long_item_breaks_between_words() {
        let m = Metrics::new();
        assert_eq!(
            m.wrap_list("3P-Y · 400 V", 216.0, 12.0, false),
            ["3P-Y · 400 V"]
        );
        let long = "Secondary OCPD ≤ 2500 A over the allowed total of the mains";
        let lines = m.wrap_list(long, 120.0, 12.0, false);
        assert!(lines.len() > 1);
        assert!(lines.iter().all(|l| m.width(l, 12.0, false) <= 120.0));
        assert_eq!(lines.join(" "), long);
    }
}
