import { generic_phase_main_load_schema } from '@/schema/load';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { goto } from '$app/navigation';

export const entries = () => {
	return [{ id: 'some-id' }, { id: 'other-id' }];
};

export const load = async ({ depends, params }) => {
	depends('app:workspace/load-schedule');
	const node_id = params.id.split('_').at(-1) as string;
	if (!node_id) {
		console.warn('Viewing workspace without node_id');
		goto('/workspace');
	}
	return {
		phase_main_load_form: await superValidate(zod(generic_phase_main_load_schema))
	};
};
