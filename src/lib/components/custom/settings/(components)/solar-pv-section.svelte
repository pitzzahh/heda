<script lang="ts" module>
	import type { Node } from '#lib/types/db.js';
	import type { SolarPv } from '#lib/types/solar.js';
	import { PV_BUILDINGS } from '#lib/constants.js';

	interface Props {
		root: Node;
	}

	type NumberKey = Exclude<
		keyof SolarPv,
		| 'building'
		| 'center_fed'
		| 'engineered_busbar'
		| 'on_feeder'
		| 'near_roof'
		| 'panel'
		| 'supply_side'
	>;

	const NUMBER_FIELDS: { key: NumberKey; label: string; unit: string; step: string }[] = [
		{ key: 'module_voc', label: 'Module Voc', unit: 'V', step: 'any' },
		{ key: 'module_isc', label: 'Module Isc', unit: 'A', step: 'any' },
		{ key: 'modules_per_string', label: 'Modules per string', unit: 'pcs', step: '1' },
		{ key: 'strings', label: 'Strings in parallel', unit: 'pcs', step: '1' },
		{ key: 'module_max_ocpd', label: 'Module max series fuse', unit: 'A', step: 'any' },
		{ key: 'strings_per_raceway', label: 'Strings per raceway', unit: 'pcs', step: '1' },
		{ key: 'lowest_ambient', label: 'Lowest expected ambient', unit: '°C', step: 'any' },
		{ key: 'dc_ambient', label: 'DC wiring ambient', unit: '°C', step: 'any' },
		{ key: 'inverter_backfeed', label: 'Inverter dc backfeed', unit: 'A', step: 'any' },
		{ key: 'inverter_current', label: 'Inverter output current', unit: 'A', step: 'any' },
		{ key: 'inverter_ambient', label: 'Inverter circuit ambient', unit: '°C', step: 'any' },
		{ key: 'busbar_rating', label: 'Busbar rating', unit: 'A', step: 'any' }
	];

	const NO_PANEL = 'none';
	const SUPPLY_SIDE = 'supply_side';

	const panelName = (node: Node | undefined) => node?.panel_data?.name ?? 'Panel';

	/** The stored system, or none once every field is cleared. */
	function toStored(output: SolarPv): SolarPv | undefined {
		return Object.values(output).some((value) => value !== undefined) ? output : undefined;
	}
</script>

<script lang="ts">
	import { createForm, Field, getInput, reset, setInput, validate } from '@formisch/svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import * as InputGroup from '#lib/components/ui/input-group/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import FieldErrors from '#lib/components/custom/field-errors.svelte';
	import { SOLAR_PV_SCHEMA } from '#lib/validators/solar.js';
	import { setSolarPv } from '#lib/db/mutations/index.js';
	import { getAllChildNodes } from '#lib/db/queries/index.js';

	let { root }: Props = $props();

	// Mount snapshot of the stored system; the settings dialog remounts this section.
	function buildInitialInput(): SolarPv {
		return { ...root.highest_unit_form?.solar_pv };
	}

	const form = createForm({ schema: SOLAR_PV_SCHEMA, initialInput: buildInitialInput() });
	const panels = $derived(getAllChildNodes(root.id).filter((node) => node.node_type === 'panel'));
	const supply_side = $derived(getInput(form, { path: ['supply_side'] }));
	let saving = $state(false);

	async function save() {
		if (saving) return;
		const result = await validate(form);
		if (!result.success) return;
		saving = true;
		try {
			const updated = await setSolarPv(root.id, toStored(result.output));
			if (!updated) return toast.warning('Failed to save the solar PV system');
			// The saved system becomes the new baseline, so clearing a field counts as a change.
			reset(form, { initialInput: result.output });
			toast.success('Solar PV system saved');
		} finally {
			saving = false;
		}
	}
</script>

<form
	class="flex flex-col gap-2"
	onsubmit={(e) => {
		e.preventDefault();
		save();
	}}
>
	<div class="space-y-0.5">
		<Label>Solar PV System</Label>
		<p class="text-xs text-muted-foreground">
			Identical strings of crystalline silicon modules on one interactive inverter, from their
			nameplates. The riser shows the max dc voltage (PEC 2017 6.90.2.1) and, from 80 V, the dc
			arc-fault protection it needs (6.90.2.5), circuit currents and the least conductor and OCPD
			ratings, where a device is required (6.90.2.2, 6.90.2.3), with copper sizes once the dc
			ambient is set, and the back-fed busbar check (7.5.1.12(B)(2)(c)), or on the supply side, the
			inverter breaker against the service rating (7.5.1.12(A)).
		</p>
	</div>
	<div class="grid gap-2 sm:grid-cols-2">
		{#each NUMBER_FIELDS as { key, label, unit, step } (key)}
			<Field of={form} path={[key]}>
				{#snippet children(field)}
					<div class="flex min-w-0 flex-col gap-1">
						<Label for="pv_{key}" class="text-xs font-normal">{label}</Label>
						<InputGroup.Root>
							<InputGroup.Input
								{...field.props}
								id="pv_{key}"
								type="number"
								inputmode="decimal"
								{step}
								value={field.input ?? ''}
								oninput={(e) => {
									const value = e.currentTarget.valueAsNumber;
									field.onInput(Number.isNaN(value) ? undefined : value);
								}}
								invalid={!!field.errors}
							/>
							<InputGroup.Addon align="inline-end">
								<InputGroup.Text>{unit}</InputGroup.Text>
							</InputGroup.Addon>
						</InputGroup.Root>
						<FieldErrors errors={field.errors} />
					</div>
				{/snippet}
			</Field>
		{/each}
		<Field of={form} path={['panel']}>
			{#snippet children(field)}
				<div class="flex min-w-0 flex-col gap-1">
					<Label class="text-xs font-normal">Inverter connects to</Label>
					<Select.Root
						type="single"
						value={supply_side ? SUPPLY_SIDE : (field.input ?? NO_PANEL)}
						onValueChange={(value) => {
							setInput(form, { path: ['supply_side'], input: value === SUPPLY_SIDE || undefined });
							field.onInput(value === NO_PANEL || value === SUPPLY_SIDE ? undefined : value);
						}}
					>
						<Select.Trigger class="w-full">
							{supply_side
								? 'Supply side of the service'
								: field.input
									? panelName(panels.find((panel) => panel.id === field.input))
									: 'No panel'}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value={NO_PANEL}>No panel</Select.Item>
							<Select.Item value={SUPPLY_SIDE}>Supply side of the service</Select.Item>
							{#each panels as panel (panel.id)}
								<Select.Item value={panel.id}>{panelName(panel)}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			{/snippet}
		</Field>
	</div>
	<Field of={form} path={['building']}>
		{#snippet children(field)}
			<div class="flex min-w-0 flex-col gap-1">
				<Label class="text-xs font-normal">Array location (PEC 2017 6.90.2.1)</Label>
				<Select.Root
					type="single"
					value={field.input ?? ''}
					onValueChange={(value) => field.onInput(value as SolarPv['building'])}
				>
					<Select.Trigger class="w-full">
						{PV_BUILDINGS.find((option) => option.value === field.input)?.label ??
							'Pick where the array is'}
					</Select.Trigger>
					<Select.Content>
						{#each PV_BUILDINGS as option (option.value)}
							<Select.Item value={option.value}>{option.label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<FieldErrors errors={field.errors} />
			</div>
		{/snippet}
	</Field>
	<Field of={form} path={['near_roof']}>
		{#snippet children(field)}
			<Label class="flex items-center gap-2 text-xs font-normal">
				<Checkbox
					checked={field.input ?? false}
					onCheckedChange={(checked) => field.onInput(checked)}
				/>
				DC wiring in sunlight less than 23 mm above the roof (+33 °C, 3.10.2.6(B)(3)(c))
			</Label>
		{/snippet}
	</Field>
	<Field of={form} path={['on_feeder']}>
		{#snippet children(field)}
			<Label class="flex items-center gap-2 text-xs font-normal">
				<Checkbox
					checked={field.input ?? false}
					onCheckedChange={(checked) => field.onInput(checked)}
				/>
				On that panel's feeder, away from the panel, not its busbar (7.5.1.12(B)(2)(a))
			</Label>
		{/snippet}
	</Field>
	<Field of={form} path={['center_fed']}>
		{#snippet children(field)}
			<Label class="flex items-center gap-2 text-xs font-normal">
				<Checkbox
					checked={field.input ?? false}
					onCheckedChange={(checked) => field.onInput(checked)}
				/>
				That panelboard is center-fed (PEC 2017 7.5.1.12(B)(2)(c)(4))
			</Label>
		{/snippet}
	</Field>
	<Field of={form} path={['engineered_busbar']}>
		{#snippet children(field)}
			<Label class="flex items-center gap-2 text-xs font-normal">
				<Checkbox
					checked={field.input ?? false}
					onCheckedChange={(checked) => field.onInput(checked)}
				/>
				Multiple-ampacity busbar designed under engineering supervision, with fault current and busbar
				load calculations (7.5.1.12(B)(2)(c)(5))
			</Label>
		{/snippet}
	</Field>
	<div class="flex justify-end">
		<Button type="submit" size="sm" loading={saving} disabled={!form.isDirty}>Save</Button>
	</div>
</form>
