//! The Excel exports: the schedule of loads of a panel and every panel below it, one sheet
//! per depth, and the voltage drop table, with the cells, merges and styles the app's
//! export has always written.

use heda_core::session::Session;
use heda_core::workbook::{Cell, Kind, Layout, Sheet, Style};
use serde_json::{json, Value};

fn project() -> Value {
    json!({ "id": "p", "root_node_id": "root", "settings": {} })
}

fn nodes(phase: &str) -> Vec<Value> {
    let panel = |id: &str, parent: &str, circuit: f64, phase: &str| {
        json!({
            "id": id, "node_type": "panel", "parent_id": parent, "circuit_number": circuit,
            "conductor_sets": 1, "conductor_qty": 2, "pole": "2", "length": 20,
            "conductor_insulation": "THHN-Cu", "egc_insulation": "TW-Cu", "conduit_type": "PVC",
            "panel_data": { "name": id, "phase": phase, "ambient_temperature": 30 }
        })
    };
    let load = |id: &str, circuit: f64| {
        json!({
            "id": id, "node_type": "load", "parent_id": "LP-1", "circuit_number": circuit,
            "conductor_sets": 1, "conductor_qty": 2, "pole": "1", "length": 15,
            "load_data": { "load_description": id, "load_type": "lighting_load", "quantity": 1, "varies": 400 }
        })
    };
    vec![
        json!({ "id": "root", "node_type": "root",
                "highest_unit_form": { "distribution_unit": "Utility Service", "phase": phase } }),
        panel("MDP", "root", 1.0, phase),
        panel("LP-1", "MDP", 1.0, "one_phase"),
        load("Lights", 1.0),
        load("Outlets", 2.0),
    ]
}

fn layout(phase: &str, kind: Kind, node_id: &str) -> Layout {
    let mut session = Session::default();
    session.open(project(), nodes(phase)).unwrap();
    session
        .workbook_layout(kind, node_id, "Exported Test Load schedule".into())
        .unwrap()
}

fn cell(sheet: &Sheet, row: u32, col: u16) -> (&Cell, Style) {
    sheet
        .cells
        .iter()
        .find(|c| c.0 == row && c.1 == col)
        .map(|c| (&c.2, c.3))
        .unwrap_or_else(|| panic!("no cell at {row},{col}"))
}

fn text(value: &str) -> Cell {
    Cell::Text(value.into())
}

#[test]
fn writes_one_sheet_per_depth_from_the_exported_panel_down() {
    let book = layout("one_phase", Kind::LoadSchedule, "root");
    let names: Vec<&str> = book.sheets.iter().map(|s| s.name.as_str()).collect();
    assert_eq!(names, ["1st", "2nd", "3rd"]);
    assert_eq!(book.subject, "1P Load schedule");
    assert_eq!(book.category, "1P,Load schedule,Export");
    // Exported from a sub-panel, that panel's depth names the first sheet.
    let names: Vec<String> = layout("one_phase", Kind::LoadSchedule, "LP-1")
        .sheets
        .into_iter()
        .map(|s| s.name)
        .collect();
    assert_eq!(names, ["3rd"]);
}

#[test]
fn heads_each_schedule_with_its_panel_and_supply() {
    let book = layout("one_phase", Kind::LoadSchedule, "root");
    let lp1 = &book.sheets[2];
    assert_eq!(cell(lp1, 0, 0), (&text("DESCRIPTION"), Style::Label));
    assert_eq!(
        cell(lp1, 0, 1),
        (&text(": PANELBOARD SCHEDULE"), Style::Plain)
    );
    assert_eq!(cell(lp1, 1, 1).0, &text(": 1P + E, 230V, 60Hz"));
    assert_eq!(cell(lp1, 2, 1).0, &text(": MDP"));
    assert_eq!(cell(lp1, 3, 1).0, &text(": LP-1"));
    assert_eq!(cell(&book.sheets[0], 2, 1).0, &text(": --"));
    // Header groups over their columns' headers: CIRCUIT BREAKER spans AT, AF, Pole, KAIC.
    assert_eq!(cell(lp1, 4, 5), (&text("CIRCUIT BREAKER"), Style::Group));
    assert_eq!(cell(lp1, 5, 5), (&text("AT"), Style::Sub));
    assert!(lp1.merges.contains(&(4, 5, 4, 8)));
    assert_eq!(cell(lp1, 5, 0).0, &text("CRKT NO."));
}

#[test]
fn keeps_each_value_s_type_in_the_circuits_and_the_total() {
    let book = layout("one_phase", Kind::LoadSchedule, "root");
    let lp1 = &book.sheets[2];
    // Circuit 1: engine values are numbers, the stored pole "1" stays text.
    assert_eq!(cell(lp1, 6, 0), (&Cell::Number(1.0), Style::Body));
    assert_eq!(cell(lp1, 6, 1).0, &text("Lights"));
    assert_eq!(cell(lp1, 6, 3).0, &Cell::Number(400.0));
    assert_eq!(cell(lp1, 6, 7).0, &text("1"));
    assert_eq!(cell(lp1, 6, 9).0, &Cell::Number(1.0));
    // The panel's TOTAL row after its two circuits: numbers as numbers, so Excel can sum
    // them, and the stored fields as stored.
    assert_eq!(cell(lp1, 8, 0), (&text("TOTAL"), Style::Total));
    assert_eq!(cell(lp1, 8, 1).0, &text("MAIN"));
    assert_eq!(cell(lp1, 8, 2).0, &Cell::Number(230.0));
    assert_eq!(cell(lp1, 8, 3).0, &Cell::Number(800.0));
    assert!(matches!(cell(lp1, 8, 5).0, Cell::Number(_)));
    assert_eq!(cell(lp1, 8, 7).0, &text("2"));
}

#[test]
fn lists_va_per_phase_on_a_three_phase_panel() {
    let book = layout("three_phase_wye", Kind::LoadSchedule, "root");
    let mdp = &book.sheets[1];
    assert_eq!(cell(mdp, 1, 1).0, &text(": 3P-Y + N + E, 400Y/230V, 60Hz"));
    assert_eq!(cell(mdp, 5, 5).0, &text("PHASE"));
    assert_eq!(cell(mdp, 4, 6).0, &text("VA PER PHASE"));
    assert!(mdp.merges.contains(&(4, 6, 4, 8)));
    assert_eq!(cell(mdp, 5, 9).0, &text("AT"));
    // LP-1 is single-phase on phase A: its VA under A, the other phases empty.
    let phase = cell(mdp, 6, 5).0.clone();
    let va = cell(mdp, 6, 3).0.clone();
    assert_eq!(phase, text("A"));
    assert_eq!(cell(mdp, 6, 6).0, &va);
    assert_eq!(cell(mdp, 6, 7).0, &text(""));
    assert_eq!(book.sheets[0].name, "1st");
}

#[test]
fn writes_the_voltage_drop_table() {
    let book = layout("three_phase_wye", Kind::VoltageDrop, "root");
    assert_eq!(book.subject, "3P-Y Voltage drop");
    let sheet = &book.sheets[0];
    assert_eq!(sheet.name, "Voltage Drop");
    assert_eq!(cell(sheet, 0, 0), (&text("From NODE"), Style::Tall));
    assert!(sheet.merges.contains(&(0, 0, 1, 0)));
    assert_eq!(cell(sheet, 0, 2).0, &text("PHASE"));
    assert_eq!(cell(sheet, 1, 3).0, &text("(V)"));
    let rows: Vec<&Cell> = sheet
        .cells
        .iter()
        .filter(|c| c.0 >= 2 && c.1 == 1)
        .map(|c| &c.2)
        .collect();
    assert!(rows.contains(&&text("LP-1")) && rows.contains(&&text("Lights")));
}

#[test]
fn writes_an_xlsx_file() {
    let mut session = Session::default();
    session.open(project(), nodes("one_phase")).unwrap();
    for kind in [Kind::LoadSchedule, Kind::VoltageDrop] {
        let bytes = session.workbook(kind, "root", "Test".into()).unwrap();
        assert!(bytes.starts_with(b"PK"), "{kind:?}: not a zip");
    }
    assert!(session
        .workbook(Kind::LoadSchedule, "missing", "Test".into())
        .is_err());
}

#[test]
fn stops_at_a_looping_parent_chain() {
    // A tampered file: A and B are each other's parent below a panel.
    let mut nodes = nodes("one_phase");
    nodes.push(
        json!({ "id": "A", "node_type": "panel", "parent_id": "B", "circuit_number": 1,
                       "panel_data": { "name": "A", "phase": "one_phase" } }),
    );
    nodes.push(
        json!({ "id": "B", "node_type": "panel", "parent_id": "A", "circuit_number": 1,
                       "panel_data": { "name": "B", "phase": "one_phase" } }),
    );
    let mut session = Session::default();
    session.open(project(), nodes).unwrap();
    assert!(session
        .workbook(Kind::LoadSchedule, "A", "Test".into())
        .is_ok());
}
