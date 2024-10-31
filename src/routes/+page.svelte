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

	export type NewFileSchema = z.infer<typeof newFileSchema>;
</script>

<script lang="ts">
	import { Button, buttonVariants } from '@/components/ui/button/index.js';
	import * as Dialog from '@/components/ui/dialog/index.js';
	import { Input } from '@/components/ui/input/index.js';
	import { Label } from '@/components/ui/label/index.js';
	import { NewFileForm } from '@routes/(components)';

	const { data } = $props();
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
				<NewFileForm new_file_form={data.new_file_form} />
			</Dialog.Content>
		</Dialog.Root>
		<Button variant="ghost" size="xl" class="w-full">Load File</Button>
	</div>
</div>
