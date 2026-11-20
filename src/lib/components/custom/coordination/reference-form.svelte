<script lang="ts" module>
	interface Props {
		node_id: string;
		reference: string | undefined;
	}
</script>

<script lang="ts">
	import { createForm, Field, validate } from '@formisch/svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import FieldErrors from '#lib/components/custom/field-errors.svelte';
	import { COORDINATION_REFERENCE_SCHEMA } from '#lib/validators/coordination.js';
	import { patchNode } from '#lib/db/mutations/nodes.js';
	import { cn } from '#lib/utils/index.js';

	let { node_id, reference }: Props = $props();

	// Mount snapshot; the study remounts this form when the stored reference changes.
	function buildInitialInput() {
		return { reference: reference ?? '' };
	}

	const form = createForm({
		schema: COORDINATION_REFERENCE_SCHEMA,
		initialInput: buildInitialInput()
	});

	let saving = $state(false);
	const input_id = $props.id();

	async function handleSubmit() {
		if (saving) return;
		const result = await validate(form);
		if (!result.success) return;
		saving = true;
		try {
			// Blank clears it: the pairs go back to needing documentation.
			await patchNode(node_id, { coordination_reference: result.output.reference || undefined });
			toast.success('Coordination reference saved');
		} finally {
			saving = false;
		}
	}
</script>

<form
	class="flex flex-col gap-2"
	onsubmit={(e) => {
		e.preventDefault();
		handleSubmit();
	}}
>
	<Field of={form} path={['reference']}>
		{#snippet children(field)}
			<Label for={input_id} class={cn(field.errors && 'text-destructive')}>
				Documented selection
			</Label>
			<div class="flex gap-2">
				<Input
					{...field.props}
					id={input_id}
					value={field.input ?? ''}
					placeholder="e.g. manufacturer's selectivity table, edition, page"
				/>
				<Button type="submit" size="sm" loading={saving} disabled={!form.isDirty}>Save</Button>
			</div>
			<FieldErrors errors={field.errors} />
		{/snippet}
	</Field>
</form>
