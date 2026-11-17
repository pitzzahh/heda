<script lang="ts" module>
	import type { Node } from '#lib/types/db.js';
	import type { PhaseLoadSchedule } from '#lib/types/schedule.js';

	interface Props {
		root: Node;
	}

	type SourcePath = ['utility_sc_kva'] | ['transformer_kva'] | ['transformer_z_percent'];

	const FIELDS: {
		path: SourcePath;
		label: string;
		unit: string;
		placeholder: string;
		hint: string;
	}[] = [
		{
			path: ['utility_sc_kva'],
			label: 'Utility short-circuit level',
			unit: 'kVA',
			placeholder: '1000000',
			hint: 'From the utility; 1,000,000 for Metro Manila (Ex. D14 step 3).'
		},
		{
			path: ['transformer_kva'],
			label: 'Transformer rating',
			unit: 'kVA',
			placeholder: '100',
			hint: 'Also the per-unit kVA base (Ex. D14 step 4).'
		},
		{
			path: ['transformer_z_percent'],
			label: 'Transformer impedance',
			unit: '%Z',
			placeholder: '2.5',
			hint: 'From the nameplate (Ex. D14 step 6).'
		}
	];
</script>

<script lang="ts">
	import { createForm, Field, validate } from '@formisch/svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as InputGroup from '#lib/components/ui/input-group/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import FieldErrors from '#lib/components/custom/field-errors.svelte';
	import { SHORT_CIRCUIT_SOURCE_SCHEMA } from '#lib/validators/short-circuit.js';
	import { updateShortCircuitSource } from '#lib/db/mutations/index.js';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import { cn } from '#lib/utils/index.js';
	import { METRO_MANILA_UTILITY_SC_KVA } from '#lib/constants.js';

	let { root }: Props = $props();

	const undo_redo_state = getUndoRedoState();

	// Mount snapshot of the stored source (the page remounts the form when it changes);
	// the grid level defaults to Ex. D14 step 3.
	function buildInitialInput() {
		const unit = root.highest_unit_form;
		return {
			utility_sc_kva: unit?.utility_sc_kva ?? METRO_MANILA_UTILITY_SC_KVA,
			transformer_kva: unit?.transformer_kva,
			transformer_z_percent: unit?.transformer_z_percent
		};
	}

	const form = createForm({
		schema: SHORT_CIRCUIT_SOURCE_SCHEMA,
		initialInput: buildInitialInput()
	});

	let saving = $state(false);

	async function handleSubmit() {
		if (saving) return;
		const result = await validate(form);
		if (!result.success) return;
		saving = true;
		try {
			const updated = updateShortCircuitSource(root.id, result.output);
			if (!updated) {
				toast.warning('Failed to save the source data');
				return;
			}
			undo_redo_state.setActionToUndo({
				action: 'update_node',
				previous_data: root as unknown as PhaseLoadSchedule,
				data: updated as unknown as PhaseLoadSchedule
			});
			toast.success('Short-circuit source saved');
		} finally {
			saving = false;
		}
	}
</script>

<form
	class="grid gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-(--surface-shadow)"
	onsubmit={(e) => {
		e.preventDefault();
		handleSubmit();
	}}
>
	<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
		<div class="grid gap-0.5">
			<span class="text-[9px] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
				Fault Source
			</span>
			<p class="text-sm text-muted-foreground">
				Utility and transformer data for the per-unit method of PEC 2017 Appendix D, Example D14.
			</p>
		</div>
		<Button type="submit" size="sm" class="shrink-0" loading={saving}>Save source</Button>
	</div>
	<div class="grid items-start gap-4 sm:grid-cols-3">
		{#each FIELDS as source_field (source_field.path[0])}
			<Field of={form} path={source_field.path}>
				{#snippet children(field)}
					<div class="flex min-w-0 flex-col gap-2">
						<Label class={cn({ 'text-destructive': field.errors })}>{source_field.label}</Label>
						<InputGroup.Root>
							<InputGroup.Input
								{...field.props}
								type="number"
								inputmode="decimal"
								step="any"
								min="0"
								value={field.input ?? ''}
								oninput={(e) => field.onInput(e.currentTarget.valueAsNumber)}
								placeholder={source_field.placeholder}
								invalid={!!field.errors}
							/>
							<InputGroup.Addon align="inline-end">
								<InputGroup.Text>{source_field.unit}</InputGroup.Text>
							</InputGroup.Addon>
						</InputGroup.Root>
						<p class="text-[0.8rem] text-muted-foreground">{source_field.hint}</p>
						<FieldErrors errors={field.errors} />
					</div>
				{/snippet}
			</Field>
		{/each}
	</div>
</form>
