<script module>
	import { z } from 'zod';

	export const one_main_load_schema = z.object({
		id: z.string().optional(),
		main_load_name: z.string().refine((v) => v, { message: 'A main load name is required.' }),
		wire_length: z.string().refine((v) => v, { message: 'A wire length is required.' }),
		ambient_temperature: z
			.string()
			.refine((v) => v, { message: 'An ambient temperature is required.' }),
		phase_name: z.enum(['one_phase', 'three_phase_wye', 'three_phase_delta'], {
			required_error: 'You need to select a phase name'
		}),
		circuit_number: z.string().refine((v) => v, { message: 'A circuit number is required.' })
	});
	export type OneMainLoadSchema = z.infer<typeof one_main_load_schema>;
</script>

<script lang="ts" generics="T extends SuperValidated<OneMainLoadSchema>">
	import { dev } from '$app/environment';
	import { goto } from '$app/navigation';
	import { superForm, type SuperValidated } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import SuperDebug from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import { Input } from '@/components/ui/input/index.js';
	import { Button } from '@/components/ui/button/index.js';
	import { ScrollArea } from '@/components/ui/scroll-area/index.js';
	import { Separator } from '@/components/ui/separator/index.js';
	import * as Form from '@/components/ui/form/index.js';

	interface Props {
		new_file_form: T;
		saved_path?: string;
	}

	let { new_file_form, saved_path = 'Documents',  }: Props = $props();

	const form = superForm(new_file_form, {
		SPA: true,
		validators: zodClient(one_main_load_schema),
		onUpdate: ({ form }) => {
			// toast the values
			if (form.valid) {
				toast.success('Form is valid');
				goto('/home');
			} else {
				toast.error('Form is invalid');
			}
		}
	});
	const { form: formData, enhance } = form;
</script>

<form method="POST" use:enhance>
	<Form.Field {form} name="main_load_name">
		<Form.Control>
			{#snippet children({ props })}
				<Form.Label>File name</Form.Label>
				<Input {...props} bind:value={$formData.main_load_name} />
			{/snippet}
		</Form.Control>
		<Form.Description
			>This is the main load name
          </Form.Description>
		<Form.FieldErrors />
	</Form.Field>
	<Form.Button class="w-full">Save</Form.Button>

</form>

{#if dev}
	<SuperDebug data={$formData} />
{/if}
