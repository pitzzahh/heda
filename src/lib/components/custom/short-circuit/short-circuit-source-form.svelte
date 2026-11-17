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

	const formatNumber = (value: number | undefined) =>
		value == null ? '-' : value.toLocaleString();
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
	// Phones fold the source into one summary line so the results table is on screen.
	let expanded = $state(false);
	const unit = $derived(root.highest_unit_form);

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
			expanded = false;
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
	<div class="flex items-start justify-between gap-3">
		<div class="grid min-w-0 gap-0.5">
			<span class="text-[9px] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
				Fault Source
			</span>
			<p class="text-sm text-muted-foreground max-lg:hidden">
				Utility and transformer data for the per-unit method of PEC 2017 Appendix D, Example D14.
			</p>
			{#if !expanded}
				<p class="text-sm font-medium lg:hidden">
					{#if unit?.transformer_kva == null}
						Not set
					{:else}
						Utility {formatNumber(unit.utility_sc_kva)} kVA · Transformer {formatNumber(
							unit.transformer_kva
						)} kVA, {formatNumber(unit.transformer_z_percent)} %Z
					{/if}
				</p>
			{/if}
		</div>
		<div class="flex shrink-0 gap-2">
			<Button
				type="button"
				variant="outline"
				size="sm"
				class="lg:hidden"
				aria-expanded={expanded}
				onclick={() => (expanded = !expanded)}
			>
				{expanded ? 'Hide' : 'Edit'}
			</Button>
			<Button type="submit" size="sm" class={cn({ 'max-lg:hidden': !expanded })} loading={saving}
				>Save source</Button
			>
		</div>
	</div>
	<div class={['grid items-start gap-4 sm:grid-cols-3', !expanded && 'max-lg:hidden']}>
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
