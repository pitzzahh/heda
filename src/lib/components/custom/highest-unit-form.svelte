<script lang="ts" generics="T extends SuperValidated<HighestUnitSchema>">
	import { goto, invalidate } from '$app/navigation';
	import { superForm, type SuperValidated } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { toast } from 'svelte-sonner';
	import { Input } from '@/components/ui/input/index.js';
	import * as RadioGroup from '@/components/ui/radio-group/index.js';
	import * as Form from '@/components/ui/form/index.js';
	import { tick, untrack } from 'svelte';
	import { useId } from 'bits-ui';
	import { cn } from '@/utils';
	import { buttonVariants } from '@/components/ui/button';
	import { type HighestUnitSchema, highest_unit_schema } from '@/schema';
	import { DEFAULT_PHASES_OPTIONS } from '@/constants';
	import { createProject } from '@/db/mutations/index';
	import type { Project } from '@/types/project';

	interface Props {
		highest_unit_form: T;
		closeDialog: () => void;
	}

	let { highest_unit_form, closeDialog }: Props = $props();

	const form = superForm(highest_unit_form, {
		SPA: true,
		validators: zodClient(highest_unit_schema),
		onUpdate: async ({ form }) => {
			// toast the values
			if (form.valid) {
				const created_proj = (await createProject(form.data)) as {
					project: Project;
					root_node_id: string;
				};
				await invalidate('app:workspace');

				toast.success('Form is valid');
				const redirect_url = `/workspace/load-schedule/${form.data.distribution_unit}_${created_proj.root_node_id}`;
				console.log({ created_proj, form, redirect_url });
				// TODO: Fix bug where it is not redirecting
				goto(redirect_url).then(() => closeDialog());
			} else {
				toast.error('Form is invalid');
			}
		}
	});
	const { form: formData, enhance } = form;
	const ambient_temp_trigger_id = useId();

	let open_ambient_temp = $state(false);

	// We want to refocus the trigger button when the user selects
	// an item from the list so users can continue navigating the
	// rest of the form with the keyboard.
	function closeAndFocusTrigger(trigger_id: string) {
		open_ambient_temp = false;
		tick().then(() => {
			document.getElementById(trigger_id)?.focus();
		});
	}

	$effect(() => {
		$formData.distribution_unit = untrack(() => 'Transformer');
	});
</script>

<form method="POST" use:enhance>
	<div class="grid gap-2">
		<Form.Field {form} name="distribution_unit">
			<Form.Control>
				{#snippet children({ props })}
					<Form.Label>Distribution unit</Form.Label>
					<Input
						{...props}
						bind:value={$formData.distribution_unit}
						defaultvalue="Transformer"
						placeholder="Enter the distribution unit name"
						readonly
					/>
				{/snippet}
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>
		<Form.Fieldset {form} name="phase" class="space-y-3">
			<Form.Legend>Select a phase</Form.Legend>
			<RadioGroup.Root bind:value={$formData.phase} class="flex flex-col space-y-1" name="phase">
				{#each DEFAULT_PHASES_OPTIONS as phase_option}
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label
								class={cn(
									buttonVariants({
										variant: 'outline',
										className:
											'w-full font-normal hover:bg-primary/20 [&:has([data-state=checked])]:bg-primary/20'
									}),
									{
										'cursor-not-allowed': phase_option !== '1P'
									}
								)}
							>
								<!-- Currently disable other phases except 1P -->
								<RadioGroup.Item
									value={phase_option}
									disabled={phase_option !== '1P'}
									{...props}
									class="sr-only"
								/>
								{phase_option}
							</Form.Label>
						{/snippet}
					</Form.Control>
				{/each}
			</RadioGroup.Root>
			<Form.FieldErrors />
		</Form.Fieldset>
	</div>
	<Form.Button class="w-full">Proceed</Form.Button>
</form>
