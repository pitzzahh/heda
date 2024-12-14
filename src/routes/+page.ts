import { new_file_schema, type NewFileSchema } from '@/schema';

import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

export const load = (async () => {
	return {
		new_file_form: await superValidate(zod(new_file_schema))
	};
});
