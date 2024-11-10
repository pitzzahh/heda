										import type { PageLoad } from './$types';
import { newFileSchema } from '@/components/custom/new-file-form.svelte';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

export const load = (async () => {
	return {
		new_file_form: await superValidate(zod(newFileSchema))
	};
}) satisfies PageLoad;
