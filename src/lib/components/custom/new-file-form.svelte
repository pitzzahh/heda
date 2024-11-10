<script module>
	import { z } from 'zod';

	export const newFileSchema = z.object({
		id: z.string().optional(),
		file_name: z.string().refine((v) => v, { message: 'An file_name is required.' })
	});
	export type NewFileSchema = z.infer<typeof newFileSchema>;
</script>

<script lang="ts" generics="T extends SuperValidated<NewFileSchema>">
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
		recent_files?: string[];
	}

	let { new_file_form, saved_path = 'Documents', recent_files }: Props = $props();

	const form = superForm(new_file_form, {
		SPA: true,
		validators: zodClient(newFileSchema),
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
	{#if recent_files}
		<h4 class="my-4 text-sm font-medium leading-none">Recent files</h4>
		<ScrollArea class="h-40">
			<svelte:fragment>
				{#each recent_files as rf}
					<Button
						class="w-full"
						variant="ghost"
						onclick={() => {
							$formData.file_name = rf;
							form.submit();
						}}>{rf}</Button
					>
					<Separator class="my-2" />
				{/each}
			</svelte:fragment>
		</ScrollArea>
	{/if}
</form>

{#if dev}
	<SuperDebug data={$formData} />
{/if}
