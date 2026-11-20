<script lang="ts" module>
	import type { Node } from '#lib/types/db.js';

	interface Props {
		root: Node;
	}

	const panelName = (node: Node) => node.panel_data?.name ?? 'Panel';
</script>

<script lang="ts">
	import { createForm, Field, validate } from '@formisch/svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import * as InputGroup from '#lib/components/ui/input-group/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import FieldErrors from '#lib/components/custom/field-errors.svelte';
	import { STANDBY_GENERATOR_SCHEMA } from '#lib/validators/generator.js';
	import { setGeneratorKva, setStandbyPanels } from '#lib/db/mutations/index.js';
	import { getAllChildNodes } from '#lib/db/queries/index.js';

	let { root }: Props = $props();

	// Mount snapshot of the stored rating; the settings dialog remounts this section.
	function buildInitialInput() {
		return { generator_kva: root.highest_unit_form?.generator_kva };
	}

	const form = createForm({ schema: STANDBY_GENERATOR_SCHEMA, initialInput: buildInitialInput() });
	const panels = $derived(getAllChildNodes(root.id).filter((node) => node.node_type === 'panel'));
	const standby = $derived(root.highest_unit_form?.standby_panels ?? []);
	let saving = $state(false);

	async function saveRating() {
		if (saving) return;
		const result = await validate(form);
		if (!result.success) return;
		saving = true;
		try {
			const updated = await setGeneratorKva(root.id, result.output.generator_kva);
			if (!updated) return toast.warning('Failed to save the generator rating');
			toast.success('Generator rating saved');
		} finally {
			saving = false;
		}
	}

	async function toggle(panel_id: string, on: boolean) {
		const ids = on ? [...standby, panel_id] : standby.filter((id) => id !== panel_id);
		if (!(await setStandbyPanels(root.id, ids))) toast.warning('Failed to save the standby panels');
	}
</script>

<form
	class="flex flex-col gap-2"
	onsubmit={(e) => {
		e.preventDefault();
		saveRating();
	}}
>
	<div class="space-y-0.5">
		<Label for="generator_kva">Standby Generator</Label>
		<p class="text-xs text-muted-foreground">
			Sized for the full load of the panels it carries (PEC 2017 7.2.1.4(B)); its conductors carry
			115 % of its rated current (4.45.1.13). The riser shows the check.
		</p>
	</div>
	<Field of={form} path={['generator_kva']}>
		{#snippet children(field)}
			<div class="flex items-start gap-2">
				<div class="flex min-w-0 flex-1 flex-col gap-1">
					<InputGroup.Root>
						<InputGroup.Input
							{...field.props}
							id="generator_kva"
							type="number"
							inputmode="decimal"
							step="any"
							min="0"
							value={field.input ?? ''}
							oninput={(e) => {
								const value = e.currentTarget.valueAsNumber;
								field.onInput(Number.isNaN(value) ? undefined : value);
							}}
							placeholder="Rating (optional)"
							invalid={!!field.errors}
						/>
						<InputGroup.Addon align="inline-end">
							<InputGroup.Text>kVA</InputGroup.Text>
						</InputGroup.Addon>
					</InputGroup.Root>
					<FieldErrors errors={field.errors} />
				</div>
				<Button type="submit" size="sm" loading={saving} disabled={!form.isDirty}>Save</Button>
			</div>
		{/snippet}
	</Field>
	{#if panels.length > 0}
		<div class="flex flex-col gap-1.5">
			{#each panels as panel (panel.id)}
				<Label class="flex items-center gap-2 font-normal">
					<Checkbox
						checked={standby.includes(panel.id)}
						onCheckedChange={(on) => toggle(panel.id, on)}
					/>
					{panelName(panel)}
				</Label>
			{/each}
		</div>
	{/if}
</form>
