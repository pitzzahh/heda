import { new_file_schema } from '@/schema';
import { getEnv } from '@/helpers/security/index.js';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

export const load = (async () => {
	return {
		new_file_form: await superValidate(zod(new_file_schema)),
		app_pass_phrase: await getEnv('APP_PASS_PHRASE'),
		file_encryption_salt: await getEnv('FILE_ENCRYPTION_SALT')
	};
});
