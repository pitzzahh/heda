//! The riser diagram as a standalone SVG file: the engine's layout (`riser.rs`) drawn the
//! way the app draws it on screen (`riser-drawing.svelte`), but the whole diagram at
//! 100 %, black on white, with a font every viewer has. Written with the `svg` crate,
//! which escapes the panel names and labels.

use crate::riser::{RiserLayout, BREAKER_HEIGHT, LINE, TRANSFORMER_HEIGHT};
use svg::node::element::path::Data;
use svg::node::element::{Circle, Definitions, Group, Line, Path, Rectangle, Symbol, Text, Use};
use svg::Document;

const PAPER: &str = "#ffffff";
const INK: &str = "#000000";
/// The secondary lines of a panelboard box (the screen's muted text).
const MUTED: &str = "#333333";

/// The symbols of PEC 2017 Appendix A the diagram places, once each.
fn symbols() -> Definitions {
    // Appendix A 1.11: circuit breaker, terminals and the arc between.
    let breaker = Symbol::new()
        .set("id", "riser-breaker")
        .set("overflow", "visible")
        .add(Circle::new().set("r", 2.5).set("fill", "currentColor"))
        .add(
            Path::new()
                .set("fill", "none")
                .set("d", format!("M0 0 A11 11 0 0 1 0 {BREAKER_HEIGHT}")),
        )
        .add(
            Circle::new()
                .set("r", 2.5)
                .set("fill", "currentColor")
                .set("cy", BREAKER_HEIGHT),
        );
    // Appendix A 1.37: one cross-line per wire.
    let tick = Symbol::new()
        .set("id", "riser-tick")
        .set("overflow", "visible")
        .add(line(-5.0, 3.0, 5.0, -3.0));
    // Appendix A 3.1: transformer with two separate windings.
    let transformer = Symbol::new()
        .set("id", "riser-transformer")
        .set("overflow", "visible")
        .add(line(0.0, 0.0, 0.0, 11.0))
        .add(
            Path::new()
                .set(
                    "d",
                    "M-15 16 a5 5 0 0 1 10 0 a5 5 0 0 1 10 0 a5 5 0 0 1 10 0",
                )
                .set("fill", "none"),
        )
        .add(
            Path::new()
                .set(
                    "d",
                    "M-15 24 a5 5 0 0 0 10 0 a5 5 0 0 0 10 0 a5 5 0 0 0 10 0",
                )
                .set("fill", "none"),
        )
        .add(line(0.0, 29.0, 0.0, TRANSFORMER_HEIGHT));
    Definitions::new().add(breaker).add(tick).add(transformer)
}

fn line(x1: f64, y1: f64, x2: f64, y2: f64) -> Line {
    Line::new()
        .set("x1", x1)
        .set("y1", y1)
        .set("x2", x2)
        .set("y2", y2)
}

fn place(symbol: &str, x: f64, y: f64) -> Use {
    // `xlink:href` too: SVG 1.1 tools (older Inkscape, Illustrator, CAD importers) ignore `href`.
    Use::new()
        .set("href", format!("#{symbol}"))
        .set("xlink:href", format!("#{symbol}"))
        .set("x", x)
        .set("y", y)
}

fn text(x: f64, y: f64, content: &str) -> Text {
    // XML 1.0 has no way to write these, escaped or not; names pasted from spreadsheets carry them.
    let content: String = content
        .chars()
        .filter(|&c| !matches!(c, '\0'..='\x08' | '\x0b' | '\x0c' | '\x0e'..='\x1f' | '\u{fffe}' | '\u{ffff}'))
        .collect();
    Text::new(content)
        .set("x", x)
        .set("y", y)
        .set("stroke", "none")
}

/// The whole diagram as SVG text.
pub fn riser_svg(layout: &RiserLayout) -> String {
    // Every wire as one path, as on screen.
    let mut wires = Data::new();
    for wire in &layout.wires {
        for (i, &[x, y]) in wire.iter().enumerate() {
            wires = if i == 0 {
                wires.move_to((x, y))
            } else {
                wires.line_to((x, y))
            };
        }
    }
    let mut drawing = Group::new()
        .set("stroke", "currentColor")
        .set("stroke-width", 1.5)
        .add(Path::new().set("fill", "none").set("d", wires));
    if let Some([x, y]) = layout.transformer {
        drawing = drawing.add(place("riser-transformer", x, y));
    }
    for &[x, y] in &layout.breakers {
        drawing = drawing.add(place("riser-breaker", x, y));
    }
    for tick in &layout.ticks {
        for n in 0..tick.count as usize {
            drawing = drawing.add(place("riser-tick", tick.x, tick.y + n as f64 * 5.0));
        }
    }
    for b in &layout.boxes {
        // Appendix A 1.14: a panelboard is a plain rectangle.
        drawing = drawing
            .add(
                Rectangle::new()
                    .set("rx", 2)
                    .set("x", b.x)
                    .set("y", b.y)
                    .set("width", b.width)
                    .set("height", b.height)
                    .set("fill", PAPER),
            )
            .add(
                text(b.x + 12.0, b.y + 12.0 + LINE - 4.0, &b.title)
                    .set("font-weight", 700)
                    .set("fill", "currentColor"),
            );
        for (i, line) in b.lines.iter().enumerate() {
            let y = b.y + 12.0 + LINE * (i as f64 + 2.0) - 4.0;
            drawing = drawing.add(text(b.x + 12.0, y, line).set("fill", MUTED));
        }
    }
    for label in &layout.labels {
        for (i, line) in label.lines.iter().enumerate() {
            drawing = drawing.add(
                text(label.x, label.y + LINE * i as f64, line)
                    .set("font-size", 11)
                    .set("fill", "currentColor"),
            );
        }
    }
    if let Some([x, y]) = layout.meter {
        // Appendix A 1.7: kilowatt-hour meter.
        drawing = drawing
            .add(
                Circle::new()
                    .set("cx", x)
                    .set("cy", y)
                    .set("r", 9)
                    .set("fill", PAPER),
            )
            .add(
                text(x, y + 4.0, "M")
                    .set("text-anchor", "middle")
                    .set("font-size", 10)
                    .set("font-weight", 700)
                    .set("fill", "currentColor"),
            );
    }
    if let Some([x, y]) = layout.ground {
        // Appendix A 1.3: earth ground, for the equipment grounding of 1.3.2.1(G)(4)(c).
        drawing = drawing
            .add(line(x + 12.0, y, x + 12.0, y + 14.0))
            .add(line(x + 2.0, y + 14.0, x + 22.0, y + 14.0))
            .add(line(x + 6.0, y + 18.0, x + 18.0, y + 18.0))
            .add(line(x + 10.0, y + 22.0, x + 14.0, y + 22.0));
    }
    Document::new()
        .set("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .set("role", "img")
        .set("aria-label", "Riser diagram")
        .set("font-size", 12)
        .set("width", layout.width)
        .set("height", layout.height)
        .set("viewBox", (0, 0, layout.width, layout.height))
        .set("color", INK)
        .set("font-family", "Arial, Helvetica, sans-serif")
        .add(
            Rectangle::new()
                .set("width", "100%")
                .set("height", "100%")
                .set("fill", PAPER),
        )
        .add(symbols())
        .add(drawing)
        .to_string()
}
