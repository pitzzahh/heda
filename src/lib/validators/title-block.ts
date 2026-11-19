import * as v from 'valibot';
import { SHEET_SIZES } from '#lib/constants.js';

const TEXT_FIELD = v.optional(
	v.pipe(v.string(), v.trim(), v.maxLength(120, 'Use at most 120 characters.'))
);

/**
 * What the title block of every sheet carries, PEC 2017 1.3.2.2: (A) the project's
 * location (its name is the project's), (B) the owner, (D) the Professional Electrical
 * Engineer with the PRC license number and validity, PTR and TIN. The sheet title (C),
 * scale and date (E) and sheet number (F) are filled in per sheet; signatures and the
 * seal are put on the printed sheet.
 */
export const TITLE_BLOCK_SCHEMA = v.object({
	location: TEXT_FIELD,
	owner_name: TEXT_FIELD,
	owner_address: TEXT_FIELD,
	engineer_name: TEXT_FIELD,
	prc_license_number: TEXT_FIELD,
	prc_license_validity: TEXT_FIELD,
	ptr_number: TEXT_FIELD,
	tin: TEXT_FIELD,
	/** A PEC 2017 1.3.1.1 drawing sheet size. */
	sheet_size: v.optional(v.picklist(SHEET_SIZES.map((size) => size.value)))
});
