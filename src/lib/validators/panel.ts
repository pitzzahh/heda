import * as v from 'valibot';
import { COORDINATION_SYSTEMS, DEFAULT_THREE_PHASE_TYPES_ENUMS } from '#lib/constants.js';
import {
	AMBIENT_TEMPERATURE_FIELD,
	CIRCUIT_NUMBER_FIELD,
	LENGTH_FIELD,
	PHASE_FIELD,
	TERMINAL_TEMPERATURE_FIELD
} from './shared.js';

export const GENERIC_PHASE_PANEL_SCHEMA = v.object({
	name: v.pipe(
		v.string('Required'),
		v.check((val) => !!val, 'A panel name is required.')
	),
	circuit_number: CIRCUIT_NUMBER_FIELD,
	ambient_temperature: AMBIENT_TEMPERATURE_FIELD,
	length: LENGTH_FIELD,
	terminal_temperature: TERMINAL_TEMPERATURE_FIELD,
	type: v.optional(
		v.nullable(
			v.picklist(
				DEFAULT_THREE_PHASE_TYPES_ENUMS.map((v) => v.value),
				'You need to select a 3P type'
			)
		)
	),
	phase: PHASE_FIELD,
	// Absent or null for a normal panel; else the system the PEC requires to coordinate selectively.
	system: v.optional(
		v.nullable(
			v.picklist(
				COORDINATION_SYSTEMS.map((option) => option.value),
				'Please select a valid system.'
			)
		)
	)
});
