import { generic_phase_main_load_schema } from '@/schema/load';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { goto } from '$app/navigation';

export const entries = () => {
	return [{ id: 'some-id' }, { id: 'other-id' }];
};

export const load = async ({ depends, params }) => {
	depends('app:workspace/load-schedule');
	if (!params.id.split('_').at(-1)) {
		console.warn('Viewing workspace without node_id');
		goto('/');
	}
	return {
		phase_main_load_form: await superValidate(zod(generic_phase_main_load_schema))
	};
};
