//! The riser diagram as an SVG file: the screen's drawing, whole, black on white.

use heda_core::session::Session;
use serde_json::json;
use svg::node::element::tag;
use svg::parser::Event;

fn svg(panel_name: &str) -> String {
    let mut session = Session::default();
    session
        .open(
            json!({}),
            vec![
                json!({ "id": "root", "node_type": "root", "highest_unit_form": {
                    "distribution_unit": "Utility Service", "phase": "one_phase",
                    "utility_sc_kva": 1_000_000, "transformer_kva": 100, "transformer_z_percent": 2.5 } }),
                json!({ "id": "MDP", "node_type": "panel", "parent_id": "root", "circuit_number": 1,
                        "conductor_sets": 1, "conductor_qty": 2, "pole": "2",
                        "conductor_insulation": "THHN-Cu", "egc_insulation": "TW-Cu", "conduit_type": "PVC",
                        "panel_data": { "name": panel_name, "phase": "one_phase", "ambient_temperature": 30 } }),
            ],
        )
        .unwrap();
    String::from_utf8(session.riser_svg("root").unwrap()).unwrap()
}

/// Every element's name and every text, in document order.
fn parse(text: &str) -> (Vec<String>, Vec<String>) {
    let (mut tags, mut texts) = (vec![], vec![]);
    for event in svg::read(text).unwrap() {
        match event {
            Event::Tag(name, kind, _) if kind != tag::Type::End => tags.push(name.to_string()),
            Event::Text(t) => texts.push(t.split_whitespace().collect::<Vec<_>>().join(" ")),
            Event::Error(error) => panic!("not well-formed: {error:?}"),
            _ => {}
        }
    }
    (tags, texts)
}

#[test]
fn draws_the_appendix_a_symbols_and_every_panel() {
    let out = svg("MDP");
    let (tags, texts) = parse(&out);
    for symbol in ["riser-breaker", "riser-tick", "riser-transformer"] {
        assert!(out.contains(&format!("id=\"{symbol}\"")), "no {symbol}");
        assert!(
            out.contains(&format!("href=\"#{symbol}\"")),
            "{symbol} unused"
        );
    }
    assert!(
        tags.iter().filter(|t| *t == "rect").count() >= 3,
        "{tags:?}"
    );
    assert!(texts.iter().any(|t| t == "MDP"), "{texts:?}");
    assert!(texts.iter().any(|t| t == "M"), "no kWh meter: {texts:?}");
}

#[test]
fn prints_black_on_white_without_theme_classes() {
    let out = svg("MDP");
    assert!(out.contains("color=\"#000000\""));
    assert!(out.contains("fill=\"#ffffff\""));
    assert!(!out.contains("class="));
}

#[test]
fn escapes_panel_names() {
    let (_, texts) = parse(&svg("A&B <main>"));
    assert!(
        texts.iter().any(|t| t == "A&amp;B &lt;main&gt;"),
        "{texts:?}"
    );
}

#[test]
fn places_symbols_for_svg_1_1_viewers_too() {
    let out = svg("MDP");
    assert!(out.contains("xmlns:xlink=\"http://www.w3.org/1999/xlink\""));
    for symbol in ["riser-breaker", "riser-tick", "riser-transformer"] {
        assert!(
            out.contains(&format!("xlink:href=\"#{symbol}\"")),
            "{symbol}"
        );
    }
}

#[test]
fn drops_characters_xml_cannot_hold() {
    let (_, texts) = parse(&svg("LP\u{b}-1\u{1}"));
    assert!(texts.iter().any(|t| t == "LP-1"), "{texts:?}");
}

#[test]
fn draws_every_panel_breaker_and_tick_across_the_whole_width() {
    use heda_core::riser::{RiserBox, RiserLabel, RiserLayout, Tick};
    // Three panels across 10 000 px, far wider than any screen shows at once.
    let layout = RiserLayout {
        width: 10_000.0,
        height: 400.0,
        boxes: ["MDP", "LP-1", "LP-2"]
            .iter()
            .enumerate()
            .map(|(i, id)| RiserBox {
                id: id.to_string(),
                x: i as f64 * 4_000.0,
                y: 100.0,
                width: 240.0,
                height: 80.0,
                title: id.to_string(),
                lines: vec![],
            })
            .collect(),
        labels: vec![RiserLabel {
            id: "LP-2".into(),
            x: 8_016.0,
            y: 20.0,
            lines: vec!["CKT 2: 60 AT / 60 AF, 2P".into()],
        }],
        breakers: vec![[0.0, 8.0], [4_000.0, 8.0], [8_000.0, 8.0]],
        ticks: vec![
            Tick {
                x: 4_000.0,
                y: 40.0,
                count: 3.0,
            },
            Tick {
                x: 8_000.0,
                y: 40.0,
                count: 4.0,
            },
        ],
        ..Default::default()
    };
    let out = heda_core::riser_svg::riser_svg(&layout);
    let (_, texts) = parse(&out);
    for title in ["MDP", "LP-1", "LP-2", "CKT 2: 60 AT / 60 AF, 2P"] {
        assert!(texts.iter().any(|t| t == title), "no {title}: {texts:?}");
    }
    let uses = |symbol: &str| out.matches(&format!(" href=\"#{symbol}\"")).count();
    assert_eq!(uses("riser-breaker"), 3);
    assert_eq!(uses("riser-tick"), 7);
    assert_eq!(out.matches("<rect").count(), 1 + 3, "page + panels");
    // The whole diagram at 100 %, not a panned or zoomed view.
    assert!(out.contains("viewBox=\"0 0 10000 400\""), "{out}");
    assert!(out.contains("width=\"10000\"") && out.contains("height=\"400\""));
}
