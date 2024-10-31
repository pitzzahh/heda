<script module>
	import { z } from 'zod';

	export const themes = ['light', 'dark'] as const;
	export const languages = ['en', 'es', 'fr'] as const;
	export const allergies = ['peanuts', 'dairy', 'gluten', 'soy', 'shellfish'] as const;

	export const newFileSchema = z.object({
		id: z.string(),
		file_name: z.string({
			invalid_type_error: 'File name must be a string',
			message: 'A filename is required'
		})
	});
</script>

<script lang="ts" generics="T extends SuperValidated<NewFileSchema>">
	import { Button, buttonVariants } from '@/components/ui/button/index.js';
	import * as Dialog from '@/components/ui/dialog/index.js';
	import { Input } from '@/components/ui/input/index.js';
	import { Label } from '@/components/ui/label/index.js';
	import { superForm, type SuperValidated } from 'sveltekit-superforms';
	import * as Form from '@/components/ui/form/index.js';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import type { NewFileSchema } from '@routes/+page.svelte';
	import SuperDebug from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';

	interface Props {
		new_file_form: T;
		saved_path?: string;
	}

	let { new_file_form, saved_path = 'Documents' }: Props = $props();

	const form = superForm(new_file_form, {
		validators: zodClient(newFileSchema),
		onSubmit: (values) => {
			// toast the values
			console.log(values);
			toast(`File name: ${$formData.file_name}}`);
		}
	});
	const { form: formData, enhance } = form;
</script>

<form method="POST" use:enhance>
	<Form.Field {form} name="file_name">
		<Form.Control>
			{#snippet children({ props })}
				<Form.Label>File name</Form.Label>
				<Input {...props} bind:value={$formData.file_name} />
			{/snippet}
		</Form.Control>
		<Form.Description
			>The saved path is in {saved_path}, and can be changed later in settings.</Form.Description
		>
		<Form.FieldErrors />
	</Form.Field>
	<Form.Button class="w-full">Save</Form.Button>
</form>

<SuperDebug data={$formData} />
