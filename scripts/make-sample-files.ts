/**
 * Writes realistic sample `.heda` files for manual testing.
 *
 * The files are built from the same shapes the app stores (see
 * `src/lib/validators/db.ts`) and sealed with the app's own format code
 * (`src/lib/helpers/file/format.ts`), so opening one exercises the real
 * read path instead of a lookalike.
 *
 * Run: `bun scripts/make-sample-files.ts`
 *
 * Device-sealed (v3) files open without a password on this machine. The
 * password-sealed (v2) copies open anywhere with the password below.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
	decryptFilePayload,
	detectFileVersion,
	packFileV2,
	packFileV3
} from '#lib/helpers/file/format.js';
import { computeVoltageDropsFromNodes } from '#lib/db/queries/voltage-drop-core.js';
import { migrateFileExport } from '#lib/helpers/file/migrations.js';
import { DEFAULT_LOAD_TYPES, DEFAULT_PHASES } from '#lib/constants/index.js';
import type { FileExport } from '#lib/types/main/index.js';
import type { Node } from '#lib/types/db/index.js';

const LOAD_TYPES = new Set<string>(DEFAULT_LOAD_TYPES.map((option) => option.value));
const PHASES = new Set<string>(DEFAULT_PHASES.map((option) => option.value));

const SCRIPT_DIR = new URL('.', import.meta.url).pathname;
const OUTPUT_DIR = join(SCRIPT_DIR, '..', 'samples');
const DEVICE_KEY_PATH = join(homedir(), '.local/share/me.araopj.heda/heda-d');
const SAMPLE_PASSWORD = 'heda-sample-2026';

type Overrides = {
	at?: number;
	conductor_size?: number;
	egc_size?: number;
	conduit_size?: number;
	ampere_frames?: number;
	length?: number;
	z?: number;
};

type LoadSpec = {
	circuit: number;
	description: string;
	quantity: number;
	varies: string;
	load_type: string;
	continuous?: boolean;
	length: number;
	terminal_temperature?: string;
	ambient_temperature?: number;
	conductor_sets?: number;
	conductor_qty?: number;
	pole?: string;
	/** Uses the trip rating instead of the load current for the voltage drop. */
	use_at_as_current?: boolean;
	overrides?: Overrides;
};

type PanelSpec = {
	circuit: number;
	name: string;
	phase: string;
	length: number;
	terminal_temperature?: string;
	ambient_temperature?: number;
	conductor_sets?: number;
	conductor_qty?: number;
	pole?: string;
	overrides?: Overrides;
	children: (PanelSpec | LoadSpec)[];
};

type SampleSpec = {
	file_name: string;
	project_name: string;
	distribution_unit: string;
	phase: string;
	panels: PanelSpec[];
};

const NODE_DEFAULTS = {
	conductor_sets: 1,
	conductor_qty: 2,
	conductor_insulation: 'THHN-Cu',
	egc_insulation: 'TW-Cu',
	conduit_type: 'PVC',
	pole: '2',
	kaic: '5',
	is_at_used_as_currents_value: false
};

function isPanel(spec: PanelSpec | LoadSpec): spec is PanelSpec {
	return 'children' in spec;
}

/** A stable id per path, so regenerating the samples does not rewrite them. */
function stableId(path: string): string {
	const seeds = [0x811c9dc5, 0x1000193, 0x9e3779b9, 0x85ebca6b];
	const hex = seeds
		.map((seed) => {
			let hash = seed;
			for (let index = 0; index < path.length; index++) {
				hash ^= path.charCodeAt(index);
				hash = Math.imul(hash, 0x01000193) >>> 0;
			}
			return hash.toString(16).padStart(8, '0');
		})
		.join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function applyOverrides(node: Node, overrides?: Overrides): Node {
	if (!overrides) return node;
	const mapped: Record<string, number | undefined> = {
		at: overrides.at,
		conductor_size: overrides.conductor_size,
		egc_size: overrides.egc_size,
		conduit_size: overrides.conduit_size,
		ampere_frames: overrides.ampere_frames,
		length: overrides.length,
		z: overrides.z
	};
	for (const [key, value] of Object.entries(mapped)) {
		if (value === undefined) continue;
		if (key === 'conductor_size') node.overrided_conductor_size = value;
		if (key === 'egc_size') node.overrided_egc_size = value;
		if (key === 'conduit_size') node.overrided_conduit_size = value;
		if (key === 'ampere_frames') node.overrided_ampere_frames = value;
		if (key === 'at') node.overrided_at = value;
		if (key === 'length') node.overrided_length = value;
		if (key === 'z') node.overrided_z = value;
	}
	return node;
}

function buildFile(spec: SampleSpec): FileExport {
	const nodes: Node[] = [];
	const root_id = stableId(`${spec.file_name}/root`);
	const root: Node = {
		...NODE_DEFAULTS,
		id: root_id,
		node_type: 'root',
		highest_unit_form: { distribution_unit: spec.distribution_unit, phase: spec.phase },
		child_ids: [],
		length: 0,
		circuit_number: 0
	};

	const addPanel = (panel: PanelSpec, parent_id: string, path: string) => {
		const id = stableId(path);
		const node: Node = {
			...NODE_DEFAULTS,
			id,
			node_type: 'panel',
			parent_id,
			child_ids: [],
			length: panel.length,
			circuit_number: panel.circuit,
			panel_data: {
				name: panel.name,
				terminal_temperature: panel.terminal_temperature ?? '75',
				ambient_temperature: panel.ambient_temperature ?? 30,
				phase: panel.phase
			},
			conductor_sets: panel.conductor_sets ?? NODE_DEFAULTS.conductor_sets,
			conductor_qty: panel.conductor_qty ?? NODE_DEFAULTS.conductor_qty,
			pole: panel.pole ?? NODE_DEFAULTS.pole
		};
		applyOverrides(node, panel.overrides);
		nodes.push(node);

		for (const child of panel.children) {
			if (isPanel(child)) {
				addPanel(child, id, `${path}/${child.name}`);
				continue;
			}
			const child_id = stableId(`${path}/${child.circuit}-${child.description}`);
			const load_node: Node = {
				...NODE_DEFAULTS,
				id: child_id,
				node_type: 'load',
				parent_id: id,
				child_ids: [],
				length: child.length,
				circuit_number: child.circuit,
				load_data: {
					load_description: `${child.quantity} - ${child.description}`,
					terminal_temperature: child.terminal_temperature ?? '75',
					ambient_temperature: child.ambient_temperature ?? 30,
					quantity: child.quantity,
					varies: child.varies,
					continuous: child.continuous ?? true,
					load_type: child.load_type,
					config_preference: 'CUSTOM'
				},
				conductor_sets: child.conductor_sets ?? NODE_DEFAULTS.conductor_sets,
				conductor_qty: child.conductor_qty ?? NODE_DEFAULTS.conductor_qty,
				pole: child.pole ?? NODE_DEFAULTS.pole,
				is_at_used_as_currents_value: child.use_at_as_current ?? false
			};
			applyOverrides(load_node, child.overrides);
			nodes.push(load_node);
			node.child_ids.push(child_id);
		}
	};

	for (const panel of spec.panels) {
		addPanel(panel, root_id, `${spec.file_name}/${panel.name}`);
		root.child_ids.push(stableId(`${spec.file_name}/${panel.name}`));
	}

	return {
		project: {
			id: stableId(`${spec.file_name}/project`),
			project_name: spec.project_name,
			settings: { is_adjustment_factor_dynamic: false },
			root_node_id: root_id
		},
		nodes: [root, ...nodes]
	};
}

const SAMPLES: SampleSpec[] = [
	{
		file_name: 'maple-street-residence.heda',
		project_name: 'Maple Street Residence',
		distribution_unit: 'Utility Meter / MDU',
		phase: 'one_phase',
		panels: [
			{
				circuit: 1,
				name: 'Main Distribution Board',
				phase: 'one_phase',
				length: 12,
				children: [
					{
						circuit: 1,
						description: 'Lighting Outlet (100W)',
						quantity: 10,
						varies: '100',
						load_type: 'lighting_load',
						length: 25,
						terminal_temperature: '60'
					},
					{
						circuit: 2,
						description: 'Lighting Outlet (50W)',
						quantity: 14,
						varies: '50',
						load_type: 'lighting_load',
						length: 32,
						terminal_temperature: '60'
					},
					{
						circuit: 3,
						description: 'Convenience Outlet (Duplex)',
						quantity: 8,
						varies: '180',
						load_type: 'convenience_outlet',
						length: 25
					},
					{
						circuit: 4,
						description: 'Small Appliance Load',
						quantity: 2,
						varies: '1500',
						load_type: 'convenience_outlet',
						length: 14
					},
					{
						circuit: 5,
						description: 'Laundry Circuit Load',
						quantity: 1,
						varies: '1500',
						load_type: 'convenience_outlet',
						length: 16
					},
					{
						circuit: 6,
						description: 'Water Heater 3 kW',
						quantity: 1,
						varies: '3000',
						load_type: 'heating_equipment',
						length: 12
					},
					{
						circuit: 7,
						description: 'Split Air Conditioner 1.5 HP',
						quantity: 1,
						varies: '6',
						load_type: 'one_phase_motor_rated_current',
						continuous: false,
						length: 15
					},
					{
						circuit: 8,
						description: 'Back Porch Light',
						quantity: 1,
						varies: '100',
						load_type: 'lighting_load',
						length: 20,
						overrides: { at: 20, conductor_size: 3.5, egc_size: 10, conduit_size: 20 }
					},
					{
						circuit: 9,
						name: 'Garage Sub-Panel',
						phase: 'one_phase',
						length: 28,
						children: [
							{
								circuit: 1,
								description: 'Lighting Outlet (100W)',
								quantity: 4,
								varies: '100',
								load_type: 'lighting_load',
								length: 12,
								terminal_temperature: '60'
							},
							{
								circuit: 2,
								description: 'Convenience Outlet (Duplex)',
								quantity: 3,
								varies: '180',
								load_type: 'convenience_outlet',
								length: 22
							},
							{
								circuit: 3,
								description: 'Washer / Dryer 1P Motor',
								quantity: 1,
								varies: '9',
								load_type: 'one_phase_motor_rated_current',
								continuous: false,
								length: 18
							},
							{
								circuit: 4,
								description: 'Freezer Outlet',
								quantity: 1,
								varies: '800',
								load_type: 'convenience_outlet',
								length: 12,
								use_at_as_current: true
							}
						]
					}
				]
			}
		]
	},
	{
		file_name: 'meridian-office-building.heda',
		project_name: 'Meridian Office Building',
		distribution_unit: '500 kVA Pad-Mounted Transformer',
		phase: 'three_phase_wye',
		panels: [
			{
				circuit: 1,
				name: 'Main Switchboard',
				phase: 'three_phase_wye',
				length: 25,
				ambient_temperature: 32,
				conductor_qty: 3,
				children: [
					{
						circuit: 2,
						name: 'Level 1 Distribution Board',
						phase: 'three_phase_wye',
						length: 30,
						conductor_qty: 3,
						children: [
							{
								circuit: 1,
								description: 'Open Office Lighting',
								quantity: 320,
								varies: '24',
								load_type: 'general_lighting',
								length: 30
							},
							{
								circuit: 2,
								description: 'Convenience Outlet (Duplex)',
								quantity: 24,
								varies: '180',
								load_type: 'convenience_outlet',
								length: 25
							},
							{
								circuit: 3,
								description: 'Air Handling Unit 1',
								quantity: 1,
								varies: '18',
								load_type: 'one_phase_motor_rated_current',
								continuous: false,
								length: 28
							},
							{
								circuit: 4,
								description: 'Air Handling Unit 2',
								quantity: 1,
								varies: '18',
								load_type: 'one_phase_motor_rated_current',
								continuous: false,
								length: 28
							}
						]
					},
					{
						circuit: 3,
						name: 'Level 2 Distribution Board',
						phase: 'three_phase_wye',
						length: 25,
						conductor_qty: 3,
						children: [
							{
								circuit: 1,
								description: 'Open Office Lighting',
								quantity: 260,
								varies: '24',
								load_type: 'general_lighting',
								length: 28
							},
							{
								circuit: 2,
								description: 'Convenience Outlet (Duplex)',
								quantity: 18,
								varies: '180',
								load_type: 'convenience_outlet',
								length: 22
							},
							{
								circuit: 3,
								description: 'Passenger Elevator 3 HP',
								quantity: 1,
								varies: '17',
								load_type: 'one_phase_motor_horse_power',
								continuous: false,
								length: 30
							}
						]
					},
					{
						circuit: 4,
						name: 'Plant Room Distribution Board',
						phase: 'three_phase_wye',
						length: 35,
						conductor_qty: 3,
						children: [
							{
								circuit: 1,
								description: 'Chiller 10 HP',
								quantity: 1,
								varies: '50',
								load_type: 'one_phase_motor_horse_power',
								continuous: false,
								length: 25
							},
							{
								circuit: 2,
								description: 'Boiler Feed Pump 1 HP',
								quantity: 1,
								varies: '8',
								load_type: 'one_phase_motor_horse_power',
								continuous: false,
								length: 20
							},
							{
								circuit: 3,
								description: 'Plant Room Lighting',
								quantity: 120,
								varies: '24',
								load_type: 'general_lighting',
								length: 18
							},
							{
								circuit: 4,
								description: 'Domestic Water Heater',
								quantity: 1,
								varies: '6000',
								load_type: 'heating_equipment',
								length: 15
							}
						]
					}
				]
			}
		]
	},
	{
		file_name: 'northpoint-cold-storage.heda',
		project_name: 'Northpoint Cold Storage',
		distribution_unit: '1500 kVA Dry-Type Transformer',
		phase: 'three_phase_delta',
		panels: [
			{
				circuit: 1,
				name: 'Main Low Voltage Switchgear',
				phase: 'three_phase_delta',
				length: 20,
				conductor_sets: 2,
				conductor_qty: 3,
				children: [
					{
						circuit: 2,
						name: 'Compressor Room MCC',
						phase: 'three_phase_delta',
						length: 15,
						conductor_sets: 2,
						conductor_qty: 3,
						children: [
							{
								circuit: 1,
								description: 'Ammonia Compressor #1 (10 HP)',
								quantity: 1,
								varies: '50',
								load_type: 'one_phase_motor_horse_power',
								continuous: false,
								length: 15
							},
							{
								circuit: 2,
								description: 'Ammonia Compressor #2 (10 HP)',
								quantity: 1,
								varies: '50',
								load_type: 'one_phase_motor_horse_power',
								continuous: false,
								length: 15
							},
							{
								circuit: 3,
								description: 'Evaporator Fan (5 HP)',
								quantity: 2,
								varies: '28',
								load_type: 'one_phase_motor_horse_power',
								continuous: false,
								length: 20
							},
							{
								circuit: 4,
								description: 'Cooling Tower Fan (3 HP)',
								quantity: 2,
								varies: '17',
								load_type: 'one_phase_motor_horse_power',
								continuous: false,
								length: 25
							},
							{
								circuit: 5,
								description: 'Defrost Heater Bank',
								quantity: 1,
								varies: '9000',
								load_type: 'heating_equipment',
								length: 15
							},
							{
								circuit: 6,
								description: 'Cold Room Lighting',
								quantity: 450,
								varies: '12',
								load_type: 'general_lighting',
								length: 22
							}
						]
					},
					{
						circuit: 3,
						name: 'Packing & Loading Bay MCC',
						phase: 'three_phase_wye',
						length: 25,
						conductor_sets: 1,
						conductor_qty: 3,
						children: [
							{
								circuit: 1,
								description: 'Dock Area Lighting',
								quantity: 260,
								varies: '24',
								load_type: 'general_lighting',
								length: 30
							},
							{
								circuit: 2,
								description: 'Conveyor Drive Motor (5 HP)',
								quantity: 1,
								varies: '28',
								load_type: 'one_phase_motor_horse_power',
								continuous: false,
								length: 25
							},
							{
								circuit: 3,
								description: 'Packing Area Outlets',
								quantity: 12,
								varies: '180',
								load_type: 'convenience_outlet',
								length: 28
							},
							{
								circuit: 4,
								description: 'Office & Welfare Lighting',
								quantity: 90,
								varies: '24',
								load_type: 'general_lighting',
								length: 18
							}
						]
					}
				]
			}
		]
	},
	{
		file_name: 'sunrise-apartment-7a.heda',
		project_name: 'Sunrise Apartments - Unit 7A',
		distribution_unit: 'Apartment Unit (Typical)',
		phase: 'one_phase',
		panels: [
			{
				circuit: 1,
				name: 'Unit Distribution Board',
				phase: 'one_phase',
				length: 5,
				children: [
					{
						circuit: 1,
						description: 'Lighting Outlet (100W)',
						quantity: 4,
						varies: '100',
						load_type: 'lighting_load',
						length: 8,
						terminal_temperature: '60'
					},
					{
						circuit: 2,
						description: 'Convenience Outlet (Duplex)',
						quantity: 5,
						varies: '180',
						load_type: 'convenience_outlet',
						length: 11
					},
					{
						circuit: 3,
						description: 'Water Heater 2 kW',
						quantity: 1,
						varies: '2000',
						load_type: 'heating_equipment',
						length: 6
					}
				]
			}
		]
	}
];

/** Structural checks on the payload, before it is sealed. */
function checkStructure(file_export: FileExport, name: string): void {
	const { project, nodes } = file_export;
	const ids = new Set(nodes.map((node) => node.id));
	if (ids.size !== nodes.length) throw new Error(`${name}: duplicate node ids`);
	if (!ids.has(project.root_node_id)) throw new Error(`${name}: root node is missing`);

	for (const node of nodes) {
		if (node.id !== project.root_node_id && !ids.has(node.parent_id as string)) {
			throw new Error(`${name}: ${node.id} points at a missing parent`);
		}
		for (const child_id of node.child_ids) {
			if (!ids.has(child_id)) throw new Error(`${name}: ${node.id} points at a missing child`);
		}
		if (node.node_type === 'load' && !node.load_data) {
			throw new Error(`${name}: load ${node.id} has no load data`);
		}
		if (node.node_type === 'panel' && !node.panel_data) {
			throw new Error(`${name}: panel ${node.id} has no panel data`);
		}
		if (node.load_data && !LOAD_TYPES.has(node.load_data.load_type)) {
			throw new Error(`${name}: unknown load type "${node.load_data.load_type}"`);
		}
		if (node.panel_data && !PHASES.has(node.panel_data.phase)) {
			throw new Error(`${name}: unknown phase "${node.panel_data.phase}"`);
		}
		if ((node.circuit_number ?? 0) <= 0 && node.node_type !== 'root') {
			throw new Error(`${name}: ${node.id} has no circuit number`);
		}
	}

	const circuits = new Map<string, Set<number>>();
	for (const node of nodes) {
		if (node.node_type === 'root') continue;
		const key = node.parent_id as string;
		const taken = circuits.get(key) ?? new Set<number>();
		if (taken.has(node.circuit_number as number)) {
			throw new Error(`${name}: duplicate circuit number under ${key}`);
		}
		taken.add(node.circuit_number as number);
		circuits.set(key, taken);
	}

	// The app's own load and voltage-drop math must run over the tree.
	const drops = computeVoltageDropsFromNodes(nodes, false);
	if (drops.length !== nodes.length - 1) {
		throw new Error(`${name}: voltage drop pass missed ${nodes.length - 1 - drops.length} nodes`);
	}
	for (const drop of drops) {
		if (!Number.isFinite(drop.current) || !Number.isFinite(drop.percent_voltage_drop)) {
			throw new Error(`${name}: ${drop.id} computed a value that is not a number`);
		}
	}

	// The load path runs every file through the migration before it inserts it.
	const migrated = migrateFileExport(file_export);
	if (migrated.nodes.length !== file_export.nodes.length) {
		throw new Error(`${name}: the migration changed the node count`);
	}
}

async function readDeviceKey(): Promise<string | null> {
	try {
		const key = (await readFile(DEVICE_KEY_PATH, 'utf-8')).trim();
		return key.length > 0 ? key : null;
	} catch {
		return null;
	}
}

/** Reads the file back from disk and opens it the way the app would. */
async function verifyWritten(
	name: string,
	raw: string,
	password: string | null,
	device_key: string | null,
	project_name: string
): Promise<void> {
	const on_disk = await readFile(join(OUTPUT_DIR, name), 'utf-8');
	if (on_disk !== raw) throw new Error(`${name}: the file on disk differs from what was written`);
	const version = detectFileVersion(on_disk);
	const opened = await decryptFilePayload<FileExport>(on_disk, password, device_key);
	if (opened.project.project_name !== project_name) {
		throw new Error(`${name}: the project name did not survive the round trip`);
	}
	if (version !== 3 && version !== 2)
		throw new Error(`${name}: unexpected file version ${version}`);
}

async function main() {
	await mkdir(OUTPUT_DIR, { recursive: true });
	const device_key = await readDeviceKey();
	if (!device_key) {
		console.log(`No device key at ${DEVICE_KEY_PATH}; writing password-sealed files only.`);
	}

	for (const spec of SAMPLES) {
		const file_export = buildFile(spec);
		checkStructure(file_export, spec.file_name);

		const written: string[] = [];
		if (device_key) {
			const raw = await packFileV3(file_export, device_key);
			await writeFile(join(OUTPUT_DIR, spec.file_name), raw, 'utf-8');
			await verifyWritten(spec.file_name, raw, null, device_key, spec.project_name);
			written.push(spec.file_name);
		}
		// Every sample also gets a password-sealed copy: it opens on any
		// device, and it is the only way to try the password path by hand.
		const raw = await packFileV2(file_export, SAMPLE_PASSWORD);
		const password_name = spec.file_name.replace('.heda', '-password.heda');
		await writeFile(join(OUTPUT_DIR, password_name), raw, 'utf-8');
		await verifyWritten(password_name, raw, SAMPLE_PASSWORD, null, spec.project_name);
		written.push(password_name);

		const loads = file_export.nodes.filter((node) => node.node_type === 'load').length;
		const panels = file_export.nodes.filter((node) => node.node_type === 'panel').length;
		const drops = computeVoltageDropsFromNodes(file_export.nodes, false);
		const worst = drops.reduce((max, drop) => Math.max(max, drop.percent_voltage_drop), 0);
		console.log(
			`${spec.project_name}: ${panels} panels, ${loads} circuits, worst voltage drop ${worst.toFixed(2)}%`
		);
		for (const file of written) console.log(`  -> samples/${file}`);
	}

	console.log(`\nPassword for the "-password" copies: ${SAMPLE_PASSWORD}`);
}

await main();
