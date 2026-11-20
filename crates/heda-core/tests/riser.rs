//! The riser (one-line) diagram, PEC 2017 1.3.2.1(G), with the Appendix A symbols.

use heda_core::riser::{branch_summary, BOX_WIDTH, BREAKER_HEIGHT, COLUMN};
use heda_core::session::Session;
use heda_core::text::Metrics;
use serde_json::{json, Value};

fn root(form: Value) -> Value {
    json!({ "id": "root", "node_type": "root", "highest_unit_form": form })
}

fn panel(id: &str, parent: &str, circuit: f64) -> Value {
    json!({
        "id": id, "node_type": "panel", "parent_id": parent, "circuit_number": circuit,
        "conductor_sets": 1, "conductor_qty": 2, "pole": "2",
        "conductor_insulation": "THHN-Cu", "egc_insulation": "TW-Cu", "conduit_type": "PVC",
        "panel_data": { "name": id, "phase": "one_phase", "ambient_temperature": 30 }
    })
}

fn load(id: &str, parent: &str, circuit: f64) -> Value {
    json!({
        "id": id, "node_type": "load", "parent_id": parent, "circuit_number": circuit,
        "conductor_sets": 1, "conductor_qty": 2,
        "load_data": { "load_type": "lighting_load", "quantity": 1, "varies": 400 }
    })
}

fn session(nodes: Vec<Value>) -> Session {
    let mut session = Session::default();
    session.open(json!({}), nodes).unwrap();
    session
}

/// MDP feeding LP-1 and PP-1, which feeds LP-2 and LP-3.
fn tree() -> Session {
    session(vec![
        root(json!({ "phase": "one_phase" })),
        panel("MDP", "root", 1.0),
        panel("LP-1", "MDP", 1.0),
        panel("PP-1", "MDP", 2.0),
        panel("LP-2", "PP-1", 1.0),
        panel("LP-3", "PP-1", 2.0),
        load("a", "LP-1", 1.0),
        load("b", "LP-1", 2.0),
    ])
}

#[test]
fn counts_branch_breakers_by_rating_largest_first() {
    // (G)(1)(a): the panelboard's branch circuit ratings.
    assert_eq!(
        branch_summary(&[20.0, 20.0, 30.0, 20.0, 15.0]),
        ["Branch CBs:", "1 × 30 AT, 3 × 20 AT, 1 × 15 AT"]
    );
    assert_eq!(branch_summary(&[]), ["No branch circuits"]);
}

#[test]
fn every_box_line_fits_inside_the_box() {
    // Issue #367: "1 × 150 AT, 2 × 125 AT, 1 × 90 AT, 1 × 50 AT" crossed the border.
    let mut nodes = vec![
        root(json!({ "phase": "one_phase" })),
        panel("Compressor Room MCC", "root", 1.0),
    ];
    let loads: Vec<Value> = [400.0, 3000.0, 5000.0, 7000.0, 9000.0, 12000.0, 15000.0]
        .iter()
        .enumerate()
        .map(|(i, va)| {
            let mut l = load(&format!("l{i}"), "Compressor Room MCC", i as f64 + 1.0);
            l["load_data"]["varies"] = json!(va);
            l
        })
        .collect();
    nodes.extend(loads);
    let layout = session(nodes).riser("Compressor Room MCC").unwrap();
    let mcc = layout
        .boxes
        .iter()
        .find(|b| b.title == "Compressor Room MCC")
        .unwrap();
    assert!(
        mcc.lines.len() > 3,
        "the long list wrapped: {:?}",
        mcc.lines
    );
    let metrics = Metrics::new();
    for b in &layout.boxes {
        for line in &b.lines {
            let width = metrics.width(line, 12.0, false);
            assert!(width <= BOX_WIDTH - 24.0, "{line:?} is {width} wide");
        }
    }
}

#[test]
fn centres_each_panel_over_the_panels_it_feeds() {
    let layout = tree().riser("MDP").unwrap();
    let centre = |id: &str| {
        let b = layout.boxes.iter().find(|b| b.id == id).unwrap();
        b.x + b.width / 2.0
    };
    // One column per leaf, plus room for the last column's feeder label.
    assert_eq!(layout.width, 3.0 * COLUMN + 48.0 + 100.0);
    assert_eq!(centre("LP-2"), 24.0 + COLUMN * 1.5);
    assert_eq!(centre("PP-1"), (centre("LP-2") + centre("LP-3")) / 2.0);
    assert_eq!(centre("MDP"), 24.0 + 3.0 * COLUMN / 2.0);
    assert!(layout.boxes.iter().all(|b| b.width == BOX_WIDTH));
    // Every panel's feeder is labelled, the start panel's included.
    let mut labelled: Vec<&str> = layout.labels.iter().map(|l| l.id.as_str()).collect();
    labelled.sort();
    assert_eq!(labelled, ["LP-1", "LP-2", "LP-3", "MDP", "PP-1"]);
    let mdp = layout.boxes.iter().find(|b| b.id == "MDP").unwrap();
    let lp1 = layout.boxes.iter().find(|b| b.id == "LP-1").unwrap();
    assert!(
        lp1.y > mdp.y + mdp.height,
        "children sit below their feeder"
    );
}

#[test]
fn labels_feeders_and_boxes_with_the_computed_rows() {
    let mut session = tree();
    let layout = session.riser("MDP").unwrap();
    let rows = session.snapshot().computed.rows;
    let lp1 = &rows["LP-1"];
    let label = layout.labels.iter().find(|l| l.id == "LP-1").unwrap();
    // (G)(3)(a)–(d): breaker, wire size and type, raceway, ampacity over load current.
    assert_eq!(
        label.lines[0],
        format!("CKT 1: {} AT / {} AF, 2P", lp1.at, lp1.ampere_frames)
    );
    assert_eq!(
        label.lines[1],
        format!("2 × {} mm² THHN-Cu", lp1.conductor_size)
    );
    assert!(label.lines[2].starts_with("+ 1 × ") && label.lines[2].ends_with(" mm² TW-Cu EGC"));
    assert!(label.lines[3].starts_with("in ") && label.lines[3].ends_with(" mm ø PVC"));
    let ampacity = lp1.ampacity.unwrap();
    assert_eq!(
        label.lines[4],
        format!(
            "Ampacity/load: {ampacity} A / {} A = {:.2}",
            lp1.current,
            ampacity / lp1.current
        )
    );
    // (G)(1)(a): the panelboard's main and branch ratings.
    let lp1_box = layout.boxes.iter().find(|b| b.id == "LP-1").unwrap();
    assert_eq!(lp1_box.title, "LP-1");
    assert_eq!(lp1_box.lines[0], "1P · 230 V");
    assert_eq!(
        lp1_box.lines[1],
        format!("Main: {} AT / {} AF", lp1.at, lp1.ampere_frames)
    );
    assert_eq!(lp1_box.lines[2], "Branch CBs:");
}

#[test]
fn draws_the_service_supply_transformer_meter_and_ground() {
    // (G)(4): the load center's supply, from the project root.
    let mut session = session(vec![
        root(
            json!({ "distribution_unit": "Bldg A", "phase": "three_phase_wye", "transformer_kva": 150 }),
        ),
        panel("MDP", "root", 1.0),
    ]);
    let layout = session.riser("root").unwrap();
    assert_eq!(layout.boxes[0].id, "root");
    assert_eq!(layout.boxes[0].title, "Bldg A");
    assert_eq!(
        layout.boxes[0].lines,
        [
            "3P-Y · 400Y/230 V",
            "Transformer: 150 kVA",
            "Load: 0 kVA",
            "Secondary OCPD ≤ 250 A",
            // A separately derived system's grounding (tests/grounding.rs).
            "GEC ≥ 8 mm² Cu",
            "System bonding jumper ≥ 8 mm² Cu",
        ]
    );
    assert!(layout.transformer.is_some() && layout.meter.is_some() && layout.ground.is_some());
    // The service has no feeder of its own; only MDP's is labelled.
    let labelled: Vec<&str> = layout.labels.iter().map(|l| l.id.as_str()).collect();
    assert_eq!(labelled, ["MDP"]);

    let mut plain = session_without_transformer();
    assert!(plain.riser("root").unwrap().transformer.is_none());
    // From a panel there is no service to draw.
    let from_panel = plain.riser("MDP").unwrap();
    assert!(from_panel.meter.is_none() && from_panel.ground.is_none());
}

fn session_without_transformer() -> Session {
    session(vec![
        root(json!({ "phase": "one_phase" })),
        panel("MDP", "root", 1.0),
    ])
}

#[test]
fn breaks_every_feeder_at_its_breaker_and_counts_its_wires() {
    // Appendix A 1.11 (circuit breaker) and 1.37 (one cross-line per wire).
    let layout = session(vec![
        root(json!({ "phase": "one_phase" })),
        panel("MDP", "root", 1.0),
        panel("LP-1", "MDP", 1.0),
    ])
    .riser("MDP")
    .unwrap();
    assert_eq!(layout.breakers.len(), 2, "MDP's own feeder and LP-1's");
    for [x, y] in &layout.breakers {
        let through = layout.wires.iter().any(|wire| {
            wire.iter().all(|[wx, _]| wx == x)
                && wire.iter().map(|[_, wy]| *wy).fold(f64::MAX, f64::min) < y + 1.0
                && wire.iter().map(|[_, wy]| *wy).fold(f64::MIN, f64::max)
                    > y + BREAKER_HEIGHT - 1.0
        });
        assert!(!through, "no wire runs through a breaker");
    }
    assert!(layout.ticks.iter().all(|t| t.count == 2.0));
    assert_eq!(layout.ticks.len(), 2);
}

#[test]
fn has_no_diagram_for_a_missing_node() {
    assert!(tree().riser("nope").is_none());
}
