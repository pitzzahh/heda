import * as v from 'valibot';

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
	/** Table 6.90.2.1(A) ends at −40 °C. */
	lowest_ambient: v.optional(
		v.pipe(
			v.number('Please enter the lowest expected ambient temperature.'),
			v.minValue(-40, 'PEC 2017 Table 6.90.2.1(A) goes down to −40 °C.')
		)
	),
	/** 6.90.2.1: 600 V on or in one- and two-family dwellings, else 1000 V. */
	dwelling: v.optional(v.boolean()),
	inverter_current: v.optional(positive('inverter output current')),
	panel: v.optional(v.string()),
	busbar_rating: v.optional(positive('busbar rating')),
	/** 7.5.1.12(B)(2)(c)(4): a center-fed panelboard has no end opposite its main. */
	center_fed: v.optional(v.boolean())
});
