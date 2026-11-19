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
