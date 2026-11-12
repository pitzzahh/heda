/**
 * The large samples: a residential condominium tower and an enterprise
 * business park.
 *
 * Both are built the way an electrical engineer would draw them: incoming
 * sections, risers, floor distribution boards, and a distribution board per
 * dwelling unit or tenant suite. The circuits are the ones a real unit has,
 * with the loads the app's own tables expect.
 *
 * Every board stays inside what the app can size. Its conductor table stops
 * at 500 mm2, which covers a single set up to roughly 900 A, and its trip
 * ratings stop at 6,000 A. A board above that would be sized with the wrong
 * conductor, so the incoming sections carry the sizes a drawing would state
 * instead.
 */
import type { Circuit, PanelSpec, SampleSpec } from './sample-types.js';

/** A seeded generator, so every run writes the same project. */
function mulberry32(seed: number): () => number {
	let a = seed;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function between(rng: () => number, min: number, max: number): number {
	return Math.round(min + rng() * (max - min));
}

function pick<T>(rng: () => number, options: readonly T[]): T {
	return options[Math.floor(rng() * options.length) % options.length];
}

/** The circuits of one dwelling unit. */
function unitCircuits(rng: () => number, floor: number, unit: number): Circuit[] {
	const circuits: Circuit[] = [];
	const outlet_count = between(rng, 5, 9);
	const lighting_count = between(rng, 6, 12);
	const water_heater = pick(rng, ['2000', '2500', '3000']);
	const ac = pick(rng, ['8', '10', '12']);

	circuits.push(
		{
			description: 'Lighting Outlet (100W)',
			quantity: lighting_count,
			varies: '100',
			load_type: 'lighting_load',
			length: between(rng, 10, 18),
			terminal_temperature: '60'
		},
		{
			description: 'Convenience Outlet (Duplex)',
			quantity: outlet_count,
			varies: '180',
			load_type: 'convenience_outlet',
			length: between(rng, 8, 16)
		},
		{
			description: 'Small Appliance Load',
			quantity: between(rng, 1, 3),
			varies: '1500',
			load_type: 'convenience_outlet',
			length: between(rng, 8, 16)
		},
		{
			description: 'Laundry Circuit Load',
			quantity: 1,
			varies: '1500',
			load_type: 'convenience_outlet',
			length: between(rng, 9, 18)
		},
		{
			description: 'Water Heater',
			quantity: 1,
			varies: water_heater,
			load_type: 'heating_equipment',
			length: between(rng, 6, 14),
			terminal_temperature: '75'
		},
		{
			description: 'Split Air Conditioner',
			quantity: 1,
			varies: ac,
			load_type: 'one_phase_motor_rated_current',
			continuous: false,
			length: between(rng, 8, 18)
		},
		{
			description: 'Television / Data Outlet',
			quantity: between(rng, 2, 5),
			varies: '180',
			load_type: 'convenience_outlet',
			length: between(rng, 8, 20)
		}
	);

	// The unit on the top floor carries a longer run to the riser tap.
	if (floor === 40) {
		circuits[0] = { ...circuits[0], length: circuits[0].length + 4 };
	}
	// One unit per floor gets a designer's override, the way a real set of
	// drawings carries a note on the feeder.
	if (unit === 3) {
		circuits[1] = { ...circuits[1], overrides: { at: 20, conductor_size: 3.5, egc_size: 10 } };
	}
	return circuits;
}

/**
 * A 32-storey residential tower with 192 dwelling units.
 *
 * Eight incoming sections, each with two risers of two floors. The sections
 * carry the sizes a drawing would state, since the app's conductor table
 * stops below what a 1,200 A incomer needs.
 */
function buildCondominium(): SampleSpec {
	const rng = mulberry32(20260516);
	const sections = 10;
	const floors_per_section = 4;
	const units_per_floor = 4;
	const floor_height = 3.2;

	const incoming: PanelSpec[] = [];
	for (let section = 1; section <= sections; section++) {
		const risers: PanelSpec[] = [];
		for (let riser = 1; riser <= 2; riser++) {
			const floors: PanelSpec[] = [];
			for (let step = 0; step < 2; step++) {
				const floor = (section - 1) * floors_per_section + riser * 2 - 1 + step;
				const floor_db: PanelSpec = {
					circuit: floor,
					name: `Floor Distribution Board ${String(floor).padStart(2, '0')}`,
					phase: 'one_phase',
					length: Number(
						(floor_height * (floor % floors_per_section || floors_per_section)).toFixed(1)
					),
					children: [
						{
							circuit: units_per_floor + 1,
							name: `Corridor and Common Area ${String(floor).padStart(2, '0')}`,
							phase: 'one_phase',
							length: floor_height * 2,
							children: [
								{
									circuit: 1,
									description: 'Lighting Outlet (50W)',
									quantity: between(rng, 8, 16),
									varies: '50',
									load_type: 'lighting_load',
									length: between(rng, 14, 26),
									terminal_temperature: '60'
								},
								{
									circuit: 2,
									description: 'Emergency Lighting',
									quantity: between(rng, 4, 10),
									varies: '100',
									load_type: 'lighting_load',
									continuous: true,
									length: between(rng, 12, 24),
									terminal_temperature: '60'
								},
								{
									circuit: 3,
									description: 'Fire Alarm Device Circuit',
									quantity: between(rng, 6, 14),
									varies: '100',
									load_type: 'lighting_load',
									continuous: true,
									length: between(rng, 12, 26),
									terminal_temperature: '60'
								}
							]
						}
					]
				};

				for (let unit = 1; unit <= units_per_floor; unit++) {
					floor_db.children.push({
						circuit: unit,
						name: `Unit ${String(floor).padStart(2, '0')}-${String(unit).padStart(2, '0')}`,
						phase: 'one_phase',
						length: between(rng, 12, 18),
						children: unitCircuits(rng, floor, unit).map((circuit, index) => ({
							...circuit,
							circuit: index + 1
						}))
					});
				}
				floors.push(floor_db);
			}
			risers.push({
				circuit: riser,
				name: `Riser ${String.fromCharCode(64 + section)}${riser}`,
				phase: 'three_phase_wye',
				length: 18,
				conductor_qty: 3,
				children: floors
			});
		}

		incoming.push({
			circuit: section,
			name: `Incoming Section ${String.fromCharCode(64 + section)}`,
			phase: 'three_phase_wye',
			length: 12,
			ambient_temperature: 32,
			conductor_qty: 3,
			// The drawing states the incomer; the app's table stops short of it.
			overrides: { at: 1600, conductor_size: 400, egc_size: 120, conduit_size: 155 },
			children: risers
		});
	}

	const car_park: PanelSpec = {
		circuit: sections + 1,
		name: 'Basement Car Park',
		phase: 'three_phase_wye',
		length: 35,
		conductor_qty: 3,
		children: [
			{
				circuit: 1,
				name: 'Car Park Level B1',
				phase: 'one_phase',
				length: 28,
				children: [
					{
						circuit: 1,
						description: 'Car Park Lighting',
						quantity: 60,
						varies: '50',
						load_type: 'general_lighting',
						length: 45,
						terminal_temperature: '60'
					},
					{
						circuit: 2,
						description: 'Exhaust Fan (3 HP)',
						quantity: 6,
						varies: '17',
						load_type: 'one_phase_motor_horse_power',
						continuous: false,
						length: 38
					},
					{
						circuit: 3,
						description: 'Car Park Ventilation Fan (5 HP)',
						quantity: 4,
						varies: '28',
						load_type: 'one_phase_motor_horse_power',
						continuous: false,
						length: 42
					},
					{
						circuit: 4,
						description: 'Electric Vehicle Charger',
						quantity: 8,
						varies: '2200',
						load_type: 'convenience_outlet',
						continuous: true,
						length: 55
					},
					{
						circuit: 5,
						description: 'Sump Pump',
						quantity: 2,
						varies: '8',
						load_type: 'one_phase_motor_rated_current',
						continuous: false,
						length: 30
					}
				]
			},
			{
				circuit: 2,
				name: 'Basement Sump Pump Panel',
				phase: 'three_phase_wye',
				length: 22,
				conductor_qty: 3,
				children: [
					{
						circuit: 1,
						description: 'Sump Pump No. 1 (5 HP)',
						quantity: 1,
						varies: '28',
						load_type: 'one_phase_motor_horse_power',
						continuous: false,
						length: 18
					},
					{
						circuit: 2,
						description: 'Sump Pump No. 2 (5 HP)',
						quantity: 1,
						varies: '28',
						load_type: 'one_phase_motor_horse_power',
						continuous: false,
						length: 18
					}
				]
			}
		]
	};

	const essential: PanelSpec = {
		circuit: sections + 2,
		name: 'Essential Services Board',
		phase: 'three_phase_wye',
		length: 24,
		conductor_qty: 3,
		children: [
			{
				circuit: 1,
				name: 'Elevator Machine Room',
				phase: 'three_phase_wye',
				length: 28,
				conductor_qty: 3,
				children: [
					{
						circuit: 1,
						description: 'Passenger Elevator No. 1 (10 HP)',
						quantity: 1,
						varies: '50',
						load_type: 'one_phase_motor_horse_power',
						continuous: false,
						length: 26
					},
					{
						circuit: 2,
						description: 'Passenger Elevator No. 2 (10 HP)',
						quantity: 1,
						varies: '50',
						load_type: 'one_phase_motor_horse_power',
						continuous: false,
						length: 26
					},
					{
						circuit: 3,
						description: 'Elevator Controller Panel',
						quantity: 2,
						varies: '1500',
						load_type: 'convenience_outlet',
						continuous: true,
						length: 20
					}
				]
			},
			{
				circuit: 2,
				name: 'Fire Pump Panel',
				phase: 'three_phase_wye',
				length: 32,
				conductor_qty: 3,
				children: [
					{
						circuit: 1,
						description: 'Diesel Fire Pump (10 HP)',
						quantity: 1,
						varies: '50',
						load_type: 'one_phase_motor_horse_power',
						continuous: true,
						length: 24,
						conductor_qty: 3
					},
					{
						circuit: 2,
						description: 'Jockey Pump',
						quantity: 1,
						varies: '17',
						load_type: 'one_phase_motor_rated_current',
						continuous: true,
						length: 18
					},
					{
						circuit: 3,
						description: 'Sprinkler Alarm Panel',
						quantity: 1,
						varies: '500',
						load_type: 'convenience_outlet',
						continuous: true,
						length: 22
					}
				]
			},
			{
				circuit: 3,
				name: 'Standby Generator Panel',
				phase: 'three_phase_wye',
				length: 30,
				conductor_qty: 3,
				children: [
					{
						circuit: 1,
						description: 'Generator Battery Charger',
						quantity: 1,
						varies: '1500',
						load_type: 'convenience_outlet',
						continuous: true,
						length: 22
					},
					{
						circuit: 2,
						description: 'Automatic Transfer Switch',
						quantity: 1,
						varies: '300',
						load_type: 'convenience_outlet',
						continuous: true,
						length: 24
					},
					{
						circuit: 3,
						description: 'Generator Heater and Charger',
						quantity: 1,
						varies: '4000',
						load_type: 'heating_equipment',
						continuous: true,
						length: 20
					}
				]
			},
			{
				circuit: 4,
				name: 'Building Management Panel',
				phase: 'one_phase',
				length: 26,
				children: [
					{
						circuit: 1,
						description: 'Building Management System',
						quantity: 4,
						varies: '1500',
						load_type: 'convenience_outlet',
						continuous: true,
						length: 24
					},
					{
						circuit: 2,
						description: 'CCTV and Access Control',
						quantity: 20,
						varies: '180',
						load_type: 'convenience_outlet',
						continuous: true,
						length: 30
					},
					{
						circuit: 3,
						description: 'Water Tank Level Control',
						quantity: 2,
						varies: '500',
						load_type: 'convenience_outlet',
						continuous: true,
						length: 26
					}
				]
			}
		]
	};

	const plant: PanelSpec = {
		circuit: sections + 3,
		name: 'Roof Plant Room',
		phase: 'three_phase_wye',
		length: 40,
		conductor_qty: 3,
		children: [
			{
				circuit: 1,
				name: 'Water Booster Pump Panel',
				phase: 'three_phase_wye',
				length: 26,
				conductor_qty: 3,
				children: [
					{
						circuit: 1,
						description: 'Booster Pump No. 1 (10 HP)',
						quantity: 1,
						varies: '50',
						load_type: 'one_phase_motor_horse_power',
						continuous: false,
						length: 20
					},
					{
						circuit: 2,
						description: 'Booster Pump No. 2 (10 HP)',
						quantity: 1,
						varies: '50',
						load_type: 'one_phase_motor_horse_power',
						continuous: false,
						length: 20
					},
					{
						circuit: 3,
						description: 'Booster Pump No. 3 (5 HP)',
						quantity: 1,
						varies: '28',
						load_type: 'one_phase_motor_horse_power',
						continuous: false,
						length: 20
					}
				]
			},
			{
				circuit: 2,
				name: 'Central Cooling Plant',
				phase: 'three_phase_wye',
				length: 34,
				conductor_qty: 3,
				children: [
					{
						circuit: 1,
						description: 'Chiller No. 1 (10 HP)',
						quantity: 1,
						varies: '50',
						load_type: 'one_phase_motor_horse_power',
						continuous: false,
						length: 28
					},
					{
						circuit: 2,
						description: 'Chiller No. 2 (10 HP)',
						quantity: 1,
						varies: '50',
						load_type: 'one_phase_motor_horse_power',
						continuous: false,
						length: 28
					},
					{
						circuit: 3,
						description: 'Cooling Tower Fan (5 HP)',
						quantity: 3,
						varies: '28',
						load_type: 'one_phase_motor_horse_power',
						continuous: false,
						length: 32
					},
					{
						circuit: 4,
						description: 'Chilled Water Pump (10 HP)',
						quantity: 2,
						varies: '50',
						load_type: 'one_phase_motor_horse_power',
						continuous: false,
						length: 26
					},
					{
						circuit: 5,
						description: 'Condensate Pump',
						quantity: 2,
						varies: '8',
						load_type: 'one_phase_motor_rated_current',
						continuous: false,
						length: 22
					}
				]
			},
			{
				circuit: 3,
				name: 'Domestic Water Tank',
				phase: 'one_phase',
				length: 28,
				children: [
					{
						circuit: 1,
						description: 'Water Tank Lighting',
						quantity: 4,
						varies: '100',
						load_type: 'lighting_load',
						continuous: true,
						length: 20
					},
					{
						circuit: 2,
						description: 'Water Heater Bank',
						quantity: 1,
						varies: '12000',
						load_type: 'heating_equipment',
						continuous: true,
						length: 24
					}
				]
			}
		]
	};

	return {
		file_name: 'harborview-residences.heda',
		project_name: 'Harborview Residences - Tower A',
		distribution_unit: '4 x 1500 kVA Pad-Mounted Transformer',
		phase: 'three_phase_wye',
		panels: [car_park, essential, plant, ...incoming]
	};
}

/** The circuits of one tenant suite on an office floor. */
function suiteCircuits(rng: () => number, area_sqm: number): Circuit[] {
	return [
		{
			description: 'Open Office Lighting',
			quantity: area_sqm,
			varies: '24',
			load_type: 'general_lighting',
			length: between(rng, 16, 26)
		},
		{
			description: 'Convenience Outlet (Duplex)',
			quantity: between(rng, 6, 14),
			varies: '180',
			load_type: 'convenience_outlet',
			length: between(rng, 18, 32)
		},
		{
			description: 'Air Conditioning Unit',
			quantity: between(rng, 1, 2),
			varies: '18',
			load_type: 'one_phase_motor_rated_current',
			continuous: false,
			length: between(rng, 12, 20)
		},
		{
			description: 'Copy and Print Outlet',
			quantity: between(rng, 2, 6),
			varies: '500',
			load_type: 'convenience_outlet',
			length: between(rng, 18, 30)
		},
		{
			description: 'Server Rack Outlet',
			quantity: between(rng, 1, 4),
			varies: '1500',
			load_type: 'convenience_outlet',
			continuous: true,
			length: between(rng, 14, 26)
		},
		{
			description: 'Kitchenette',
			quantity: between(rng, 1, 2),
			varies: '1500',
			load_type: 'convenience_outlet',
			length: between(rng, 14, 24)
		},
		{
			description: 'Water Heater',
			quantity: 1,
			varies: '3000',
			load_type: 'heating_equipment',
			length: between(rng, 12, 22)
		},
		{
			description: 'Emergency and Exit Lighting',
			quantity: between(rng, 4, 10),
			varies: '100',
			load_type: 'lighting_load',
			continuous: true,
			length: between(rng, 16, 30),
			terminal_temperature: '60'
		}
	];
}

/**
 * A twenty-building enterprise park.
 *
 * Each building has an incoming section per five floors, so every board stays
 * inside what the app can size. The central plant, the data centre and the
 * campus services hang off the root as their own boards.
 */
function buildBusinessPark(): SampleSpec {
	const rng = mulberry32(88112026);
	const buildings = 20;
	const floors_per_building = 12;
	const suites_per_floor = 3;

	const building_boards: PanelSpec[] = [];
	for (let building = 1; building <= buildings; building++) {
		const letter = String.fromCharCode(64 + building);

		for (let part = 0; part < 3; part++) {
			const levels: PanelSpec[] = [];
			for (let floor = 1; floor <= floors_per_building / 3; floor++) {
				const level_number = part * (floors_per_building / 3) + floor;
				const level_board: PanelSpec = {
					circuit: level_number,
					name: `Building ${letter} Level ${String(level_number).padStart(2, '0')}`,
					phase: 'three_phase_wye',
					length: between(rng, 12, 20),
					conductor_qty: 3,
					children: []
				};

				for (let suite = 1; suite <= suites_per_floor; suite++) {
					const area = between(rng, 90, 220);
					level_board.children.push({
						circuit: suite,
						name: `Suite ${letter}${String(level_number).padStart(2, '0')}-${String(suite).padStart(2, '0')}`,
						phase: 'one_phase',
						length: between(rng, 18, 30),
						children: suiteCircuits(rng, area).map((circuit, index) => ({
							...circuit,
							circuit: index + 1
						}))
					});
				}

				level_board.children.push({
					circuit: suites_per_floor + 1,
					name: `Building ${letter} Level ${String(level_number).padStart(2, '0')} Common`,
					phase: 'one_phase',
					length: between(rng, 14, 24),
					children: [
						{
							circuit: 1,
							description: 'Corridor and Lavatory Lighting',
							quantity: between(rng, 12, 26),
							varies: '50',
							load_type: 'general_lighting',
							length: between(rng, 18, 30),
							terminal_temperature: '60'
						},
						{
							circuit: 2,
							description: 'Fire Alarm and Emergency Lighting',
							quantity: between(rng, 8, 18),
							varies: '100',
							load_type: 'lighting_load',
							continuous: true,
							length: between(rng, 18, 32),
							terminal_temperature: '60'
						}
					]
				});
				levels.push(level_board);
			}

			building_boards.push({
				circuit: building_boards.length + 1,
				name: `Building ${letter} Incoming Section ${part + 1}`,
				phase: 'three_phase_wye',
				length: between(rng, 18, 26),
				conductor_qty: 3,
				// The drawing states the riser; the app's table stops short.
				overrides: { at: 1000, conductor_size: 400, egc_size: 80, conduit_size: 128 },
				children: levels
			});
		}
	}

	const central_plant: PanelSpec = {
		circuit: buildings * 3 + 1,
		name: 'Central Plant',
		phase: 'three_phase_wye',
		length: 25,
		conductor_qty: 3,
		children: [
			{
				circuit: 1,
				name: 'Chiller Plant',
				phase: 'three_phase_wye',
				length: 42,
				conductor_qty: 3,
				children: [
					{
						circuit: 1,
						description: 'Air Cooled Chiller No. 1 (10 HP)',
						quantity: 1,
						varies: '50',
						load_type: 'one_phase_motor_horse_power',
						continuous: false,
						length: 34
					},
					{
						circuit: 2,
						description: 'Air Cooled Chiller No. 2 (10 HP)',
						quantity: 1,
						varies: '50',
						load_type: 'one_phase_motor_horse_power',
						continuous: false,
						length: 34
					},
					{
						circuit: 3,
						description: 'Chilled Water Pump (10 HP)',
						quantity: 4,
						varies: '50',
						load_type: 'one_phase_motor_horse_power',
						continuous: false,
						length: 30
					},
					{
						circuit: 4,
						description: 'Condenser Water Pump (5 HP)',
						quantity: 3,
						varies: '28',
						load_type: 'one_phase_motor_horse_power',
						continuous: false,
						length: 30
					},
					{
						circuit: 5,
						description: 'Air Handling Unit',
						quantity: 8,
						varies: '17',
						load_type: 'one_phase_motor_rated_current',
						continuous: false,
						length: 36
					}
				]
			},
			{
				circuit: 2,
				name: 'Boiler and Water Heating',
				phase: 'three_phase_wye',
				length: 38,
				conductor_qty: 3,
				children: [
					{
						circuit: 1,
						description: 'Steam Boiler Feed Pump (10 HP)',
						quantity: 2,
						varies: '50',
						load_type: 'one_phase_motor_horse_power',
						continuous: false,
						length: 28
					},
					{
						circuit: 2,
						description: 'Domestic Water Heating',
						quantity: 1,
						varies: '45000',
						load_type: 'heating_equipment',
						continuous: true,
						length: 32
					}
				]
			}
		]
	};

	const data_center: PanelSpec = {
		circuit: buildings * 3 + 2,
		name: 'Data Centre',
		phase: 'three_phase_wye',
		length: 25,
		conductor_qty: 3,
		children: [
			{
				circuit: 1,
				name: 'UPS Panel A',
				phase: 'three_phase_wye',
				length: 30,
				conductor_qty: 3,
				children: [
					{
						circuit: 1,
						description: 'UPS Module A',
						quantity: 1,
						varies: '250',
						load_type: 'one_phase_motor_rated_current',
						continuous: true,
						length: 22
					},
					{
						circuit: 2,
						description: 'UPS Module B',
						quantity: 1,
						varies: '250',
						load_type: 'one_phase_motor_rated_current',
						continuous: true,
						length: 22
					},
					{
						circuit: 3,
						description: 'Battery String',
						quantity: 4,
						varies: '1500',
						load_type: 'convenience_outlet',
						continuous: true,
						length: 24
					}
				]
			},
			{
				circuit: 2,
				name: 'Cooling Plant CRAC',
				phase: 'three_phase_wye',
				length: 36,
				conductor_qty: 3,
				children: [
					{
						circuit: 1,
						description: 'Computer Room Air Conditioner',
						quantity: 6,
						varies: '28',
						load_type: 'one_phase_motor_horse_power',
						continuous: true,
						length: 30
					},
					{
						circuit: 2,
						description: 'Precision Cooling Unit',
						quantity: 2,
						varies: '50',
						load_type: 'one_phase_motor_horse_power',
						continuous: true,
						length: 30
					}
				]
			}
		]
	};

	const parking: PanelSpec = {
		circuit: buildings * 3 + 3,
		name: 'Central Car Park',
		phase: 'three_phase_wye',
		length: 30,
		conductor_qty: 3,
		children: [
			{
				circuit: 1,
				description: 'Car Park Lighting',
				quantity: 180,
				varies: '50',
				load_type: 'general_lighting',
				length: 40,
				terminal_temperature: '60'
			},
			{
				circuit: 2,
				description: 'Car Park Exhaust Fan (5 HP)',
				quantity: 8,
				varies: '28',
				load_type: 'one_phase_motor_horse_power',
				continuous: false,
				length: 45
			}
		]
	};

	const ev_charging: PanelSpec = {
		circuit: buildings * 3 + 4,
		name: 'EV Charging Station',
		phase: 'three_phase_wye',
		length: 35,
		conductor_qty: 3,
		children: [
			{
				circuit: 1,
				description: 'Electric Vehicle Charger',
				quantity: 24,
				varies: '2200',
				load_type: 'convenience_outlet',
				continuous: true,
				length: 50
			}
		]
	};

	const security: PanelSpec = {
		circuit: buildings * 3 + 5,
		name: 'Security and Perimeter',
		phase: 'one_phase',
		length: 40,
		children: [
			{
				circuit: 1,
				description: 'CCTV and Perimeter Lighting',
				quantity: 60,
				varies: '180',
				load_type: 'convenience_outlet',
				continuous: true,
				length: 45
			},
			{
				circuit: 2,
				description: 'Water Treatment Plant',
				quantity: 1,
				varies: '1500',
				load_type: 'convenience_outlet',
				continuous: true,
				length: 40
			}
		]
	};

	const standby: PanelSpec = {
		circuit: buildings * 3 + 6,
		name: 'Standby Power',
		phase: 'three_phase_wye',
		length: 40,
		conductor_qty: 3,
		children: [
			{
				circuit: 1,
				description: 'Generator Battery Charger',
				quantity: 2,
				varies: '1500',
				load_type: 'convenience_outlet',
				continuous: true,
				length: 30
			},
			{
				circuit: 2,
				description: 'Fire Pump (10 HP)',
				quantity: 2,
				varies: '50',
				load_type: 'one_phase_motor_horse_power',
				continuous: true,
				length: 30,
				conductor_qty: 3
			}
		]
	};

	return {
		file_name: 'meridian-business-park.heda',
		project_name: 'Meridian Business Park',
		distribution_unit: '4 x 2000 kVA Transformer Bank',
		phase: 'three_phase_wye',
		panels: [
			central_plant,
			data_center,
			parking,
			ev_charging,
			security,
			standby,
			...building_boards
		]
	};
}

export { buildBusinessPark, buildCondominium };
