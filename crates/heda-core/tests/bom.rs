//! Bill of materials (#291): totals from the computed (or overridden) rows only.
//!
//! The project below overrides every size and rating, so each total is worked by hand:
//!
//! ```text
//! root (1P)
//! └─ MDP   cct 1, 30 m, 1 set × 2 × 38 mm² THHN, EGC 8 mm² TW, 32 mm PVC, 100 AT / 100 AF
//!    ├─ LP-1  cct 1, 20 m, 2 sets × 2 × 14 mm² THHN, EGC 5.5 mm² TW, 25 mm PVC, 60 AT / 100 AF
//!    │  ├─ a  cct 1, 10 m, 1 × 2 × 3.5 mm² THHN, EGC 3.5 mm² TW, 15 mm PVC, 20 AT / 50 AF
//!    │  └─ b  cct 2, 15 m, the same as a
//!    └─ c     cct 2, no length, 20 AT / 50 AF
//! ```

use heda_core::bom::{Breaker, ConduitRun, Panelboard, Wire, WireUse};
use heda_core::session::Session;
use heda_core::sizing::{Conduit, Egc};
use heda_core::workbook::{Cell, Kind};
use serde_json::{json, Value};

#[allow(clippy::too_many_arguments)]
fn circuit(
    id: &str,
    parent: &str,
    cct: f64,
    length: Option<f64>,
    sets: f64,
    sizes: [f64; 3],
    at: f64,
    af: f64,
) -> Value {
    let mut node = json!({
        "id": id, "parent_id": parent, "circuit_number": cct,
        "conductor_sets": sets, "conductor_qty": 2, "pole": "2",
        "conductor_insulation": "THHN-Cu", "egc_insulation": "TW-Cu", "conduit_type": "PVC",
        "overrided_conductor_size": sizes[0], "overrided_egc_size": sizes[1],
        "overrided_conduit_size": sizes[2], "overrided_at": at, "overrided_ampere_frames": af,
    });
    if let Some(length) = length {
        node["length"] = json!(length);
    }
    node
}

fn panel(mut node: Value) -> Value {
    let name = node["id"].clone();
    node["node_type"] = json!("panel");
    node["panel_data"] = json!({ "name": name, "phase": "one_phase", "ambient_temperature": 30 });
    node
}

fn load(mut node: Value, description: &str) -> Value {
    node["node_type"] = json!("load");
    node["load_data"] = json!({
        "load_type": "lighting_load", "quantity": 1, "varies": 400,
        "load_description": description
    });
    node
}

fn session() -> Session {
    let mut session = Session::default();
    session
        .open(
            json!({}),
            vec![
                json!({ "id": "root", "node_type": "root",
                        "highest_unit_form": { "phase": "one_phase" } }),
                panel(circuit(
                    "MDP",
                    "root",
                    1.0,
                    Some(30.0),
                    1.0,
                    [38.0, 8.0, 32.0],
                    100.0,
                    100.0,
                )),
                panel(circuit(
                    "LP-1",
                    "MDP",
                    1.0,
                    Some(20.0),
                    2.0,
                    [14.0, 5.5, 25.0],
                    60.0,
                    100.0,
                )),
                load(
                    circuit(
                        "a",
                        "LP-1",
                        1.0,
                        Some(10.0),
                        1.0,
                        [3.5, 3.5, 15.0],
                        20.0,
                        50.0,
                    ),
                    "a",
                ),
                load(
                    circuit(
                        "b",
                        "LP-1",
                        2.0,
                        Some(15.0),
                        1.0,
                        [3.5, 3.5, 15.0],
                        20.0,
                        50.0,
                    ),
                    "b",
                ),
                load(
                    circuit("c", "MDP", 2.0, None, 1.0, [3.5, 3.5, 15.0], 20.0, 50.0),
                    "Spare",
                ),
            ],
        )
        .unwrap();
    session
}

fn wire(use_: WireUse, size: f64, insulation: &str, length: f64) -> Wire {
    Wire {
        use_,
        size,
        insulation: insulation.into(),
        length,
    }
}

fn breaker(at: f64, af: f64, count: usize) -> Breaker {
    Breaker {
        at,
        af,
        poles: "2".into(),
        count,
    }
}

fn conduit(size: f64, length: f64) -> ConduitRun {
    ConduitRun {
        size,
        conduit_type: "PVC".into(),
        length,
    }
}

#[test]
fn totals_the_whole_project() {
    let bom = session().bill_of_materials("root").unwrap();
    assert_eq!(
        bom.wires,
        [
            // Sets × qty × length: 50 = (10 + 15) × 2, 80 = 20 × 2 × 2, 60 = 30 × 2.
            wire(WireUse::Conductor, 3.5, "THHN-Cu", 50.0),
            wire(WireUse::Conductor, 14.0, "THHN-Cu", 80.0),
            wire(WireUse::Conductor, 38.0, "THHN-Cu", 60.0),
            // One EGC per raceway, so its length is the run's: 25 = 10 + 15.
            wire(WireUse::Egc, 3.5, "TW-Cu", 25.0),
            wire(WireUse::Egc, 5.5, "TW-Cu", 20.0),
            wire(WireUse::Egc, 8.0, "TW-Cu", 30.0),
        ]
    );
    assert_eq!(
        bom.breakers,
        [
            // a, b and c.
            breaker(20.0, 50.0, 3),
            // LP-1's feeder breaker in MDP, and LP-1's own main.
            breaker(60.0, 100.0, 2),
            // MDP is fed straight from the supply: its main is its only breaker.
            breaker(100.0, 100.0, 1),
        ]
    );
    assert_eq!(
        bom.conduits,
        [
            conduit(15.0, 25.0),
            conduit(25.0, 20.0),
            conduit(32.0, 30.0)
        ]
    );
    assert_eq!(
        bom.panelboards,
        [
            Panelboard {
                name: "MDP".into(),
                phase: "1P".into(),
                main_at: 100.0,
                main_af: 100.0,
                circuits: 2
            },
            Panelboard {
                name: "LP-1".into(),
                phase: "1P".into(),
                main_at: 60.0,
                main_af: 100.0,
                circuits: 2
            },
        ]
    );
    // c has no length: its breaker counts, its wire and conduit cannot.
    assert_eq!(bom.unmeasured, ["Spare"]);
    assert!(bom.no_size.is_empty());
}

#[test]
fn a_panel_covers_itself_and_what_it_feeds_not_its_feeder() {
    let bom = session().bill_of_materials("LP-1").unwrap();
    assert_eq!(
        bom.wires,
        [
            wire(WireUse::Conductor, 3.5, "THHN-Cu", 50.0),
            wire(WireUse::Egc, 3.5, "TW-Cu", 25.0),
        ]
    );
    // Its main; its feeder breaker is in MDP.
    assert_eq!(
        bom.breakers,
        [breaker(20.0, 50.0, 2), breaker(60.0, 100.0, 1)]
    );
    assert_eq!(bom.conduits, [conduit(15.0, 25.0)]);
    assert_eq!(bom.panelboards.len(), 1);
    assert!(bom.unmeasured.is_empty());
}

#[test]
fn a_panel_fed_from_the_supply_counts_its_main() {
    // MDP hangs straight off the supply, so its main is the service disconnect (PEC 2017
    // 2.30.6.10) and the only breaker ahead of its circuits: it belongs to MDP's own list.
    let bom = session().bill_of_materials("MDP").unwrap();
    assert_eq!(
        bom.breakers,
        [
            // a, b and c.
            breaker(20.0, 50.0, 3),
            // LP-1's feeder breaker in MDP, and LP-1's own main.
            breaker(60.0, 100.0, 2),
            // MDP's main.
            breaker(100.0, 100.0, 1),
        ]
    );
}

#[test]
fn computed_sizes_flow_through_when_nothing_is_overridden() {
    let mut session = session();
    let plain = json!({
        "id": "d", "node_type": "load", "parent_id": "LP-1", "circuit_number": 3, "length": 12,
        "conductor_sets": 1, "conductor_qty": 2, "pole": "2",
        "conductor_insulation": "THHN-Cu", "egc_insulation": "TW-Cu", "conduit_type": "PVC",
        "load_data": { "load_type": "lighting_load", "quantity": 1, "varies": 400 }
    });
    session.put(vec![plain]).unwrap();
    let row = session.snapshot().computed.rows["d"].clone();
    let bom = session.bill_of_materials("LP-1").unwrap();
    // d's computed wire joins a and b when it is the same size, else stands alone.
    let size = row.conductor_size;
    let wire = bom
        .wires
        .iter()
        .find(|w| w.use_ == WireUse::Conductor && w.size == size)
        .unwrap();
    let with_ab = if size == 3.5 { 50.0 } else { 0.0 };
    assert_eq!(wire.length, with_ab + 12.0 * 2.0);
    assert!(bom
        .breakers
        .iter()
        .any(|b| b.at == row.at && b.af == row.ampere_frames));
    let Egc::Size(egc) = row.egc_size else {
        panic!("{:?}", row.egc_size)
    };
    assert!(bom
        .wires
        .iter()
        .any(|w| w.use_ == WireUse::Egc && w.size == egc));
    let Conduit::Size(conduit) = row.conduit_size else {
        panic!("{:?}", row.conduit_size)
    };
    assert!(bom.conduits.iter().any(|c| c.size == conduit));
}

#[test]
fn the_load_schedule_workbook_ends_with_the_bill_of_materials() {
    let mut session = session();
    let book = session
        .workbook_layout(Kind::LoadSchedule, "root", "Test".into())
        .unwrap();
    let sheet = book.sheets.last().unwrap();
    assert_eq!(sheet.name, "Bill of Materials");
    let texts: Vec<&str> = sheet
        .cells
        .iter()
        .filter_map(|(_, _, cell, _)| match cell {
            Cell::Text(text) => Some(text.as_str()),
            _ => None,
        })
        .collect();
    for title in [
        "CONDUCTORS",
        "EQUIPMENT GROUNDING CONDUCTORS",
        "CIRCUIT BREAKERS",
        "CONDUITS",
        "PANELBOARDS",
    ] {
        assert!(texts.contains(&title), "{title}");
    }
    assert!(texts
        .iter()
        .any(|t| t.starts_with("No length") && t.ends_with("Spare")));
}
