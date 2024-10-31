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

<script lang="ts">
	import { Button, buttonVariants } from '@/components/ui/button/index.js';
	import * as Dialog from '@/components/ui/dialog/index.js';
	import { Input } from '@/components/ui/input/index.js';
	import { Label } from '@/components/ui/label/index.js';

	import { superForm } from 'sveltekit-superforms';
	import { Field } from 'formsnap';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import SuperDebug from 'sveltekit-superforms';

	let { new_file_form } = $props();

	const form = superForm(new_file_form, {
		validators: zodClient(newFileSchema)
	});
	const { form: formData } = form;
</script>

<div class="flex min-h-screen items-center justify-center bg-background">
	<div class="flex flex-col gap-4">
		<Dialog.Root>
			<Dialog.Trigger class={buttonVariants({ size: '2xl' })}>New File</Dialog.Trigger>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>Are you sure absolutely sure?</Dialog.Title>
					<Dialog.Description>
						This action cannot be undone. This will permanently delete your account and remove your
						data from our servers.
					</Dialog.Description>
				</Dialog.Header>

				<Button href="/home" class="w-full">Save</Button>
			</Dialog.Content>
		</Dialog.Root>
		<Button variant="ghost" size="xl" class="w-full">Load File</Button>
	</div>
</div>
