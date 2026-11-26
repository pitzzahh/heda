import * as v from 'valibot';
import { PV_BUILDINGS } from '#lib/constants.js';

const positive = (name: string) =>
	v.pipe(
		v.number(`Please enter the ${name}.`),
		v.check((value) => value > 0, `The ${name} must be greater than 0.`)
	);

const count = (name: string) =>
	v.pipe(
		v.number(`Please enter the ${name}.`),
		v.integer(`The ${name} must be a whole number.`),
		v.minValue(1, `The ${name} must be at least 1.`)
	);

/**
 * An interactive solar PV system of identical strings of crystalline or multicrystalline
 * silicon modules and one inverter, on the load side of a panel (PEC 2017 Article 6.90,
 * 7.5.1.12(B)). Every field is optional; the riser shows each check once its inputs are set.
 */
export const SOLAR_PV_SCHEMA = v.object({
	module_voc: v.optional(positive('module open-circuit voltage')),
	module_isc: v.optional(positive('module short-circuit current')),
	modules_per_string: v.optional(count('modules per string')),
	strings: v.optional(count('number of strings')),
	/** The module's listed maximum series fuse rating (6.90.2.3(A) Exception (2)). */
	module_max_ocpd: v.optional(positive('module maximum series fuse rating')),
	/** Strings sharing one raceway (Table 3.10.2.6(B)(3)(a)); absent means all. */
	strings_per_raceway: v.optional(count('strings per raceway')),
	/** The inverter's rated dc backfeed current (6.90.2.3(A) Exception (1)); absent means none. */
	inverter_backfeed: v.optional(
		v.pipe(
			v.number('Please enter the inverter backfeed current.'),
			v.minValue(0, 'The inverter backfeed current cannot be negative.')
		)
	),
	/** Table 6.90.2.1(A) ends at −40 °C. */
	lowest_ambient: v.optional(
		v.pipe(
			v.number('Please enter the lowest expected ambient temperature.'),
			v.minValue(-40, 'PEC 2017 Table 6.90.2.1(A) goes down to −40 °C.')
		)
	),
	/** 6.90.2.1's building: its dc limit, and the dwellings of 7.5.1.12(B)(2)(c)(4). */
	building: v.optional(
		v.picklist(
			PV_BUILDINGS.map((option) => option.value),
			'Please select where the array is.'
		)
	),
	/** The outdoor temperature where the dc wiring runs, for its conductor sizes. */
	dc_ambient: v.optional(v.number('Please enter the dc wiring ambient temperature.')),
	/** 3.10.2.6(B)(3)(c): in sunlight less than 23 mm above the roof, 33 °C is added. */
	near_roof: v.optional(v.boolean()),
	inverter_current: v.optional(positive('inverter output current')),
	panel: v.optional(v.string()),
	/** 7.5.1.12(B)(2)(a): on that panel's feeder, away from the panel end, not its busbar. */
	on_feeder: v.optional(v.boolean()),
	/** 7.5.1.12(A): on the supply side of the service disconnecting means, not at a panel. */
	supply_side: v.optional(v.boolean()),
	busbar_rating: v.optional(positive('busbar rating')),
	/** 7.5.1.12(B)(2)(c)(4): a center-fed panelboard has no end opposite its main. */
	center_fed: v.optional(v.boolean())
});
