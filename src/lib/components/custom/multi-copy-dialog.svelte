<script module lang="ts">
	import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';

	type Props = { open_dialog: boolean; node_name: string; node_id: string };

	const MAX_COPY_COUNT = 1000;
	const LARGE_COPY_ITEMS = 400;
	const VERY_LARGE_COPY_ITEMS = 1500;

	function countFromInput(value: number | undefined) {
		if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
		return Math.min(MAX_COPY_COUNT, Math.max(1, Math.floor(value)));
	}
</script>

<script lang="ts">
	import { MinusIcon, PlusIcon, WarningCircleIcon } from '#lib/assets/icons/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { toast } from 'svelte-sonner';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import { MAX_COPY_NODES, copyAndAddNodesById } from '#lib/db/mutations/index.js';
	import { getNumberOfChildren } from '#lib/db/queries/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Button } from '#lib/components/ui/button/index.js';

	let { open_dialog = $bindable(false), node_name, node_id }: Props = $props();

	let copy_value = $state<number | undefined>(1);
	const undo_redo_state = getUndoRedoState();

	const raw_count = $derived(
		typeof copy_value === 'number' && Number.isFinite(copy_value) ? Math.floor(copy_value) : 0
	);
	const is_whole_number = $derived(typeof copy_value === 'number' && Number.isInteger(copy_value));
	const is_count_valid = $derived(is_whole_number && raw_count >= 1 && raw_count <= MAX_COPY_COUNT);
	const stepper_count = $derived(countFromInput(copy_value));
	const descendant_count = $derived(open_dialog && node_id ? getNumberOfChildren(node_id) : 0);
	const max_copies = $derived(
		Math.min(MAX_COPY_COUNT, Math.floor(MAX_COPY_NODES / (1 + descendant_count)))
	);
	const is_too_large = $derived(is_count_valid && raw_count > max_copies);
	const is_valid = $derived(is_count_valid && !is_too_large);
	const copy_count = $derived(is_valid ? raw_count : 0);
	const total_items = $derived(copy_count * (1 + descendant_count));
	const heavy_copy = $derived.by(() => {
		if (!is_valid) return null;
		if (total_items >= VERY_LARGE_COPY_ITEMS) {
			return {
				title: 'Very large copy',
				description: `This creates ${total_items.toLocaleString()} items. The copy runs in the background, but a project this size uses more memory and takes longer to save.`
			};
		}
		if (total_items >= LARGE_COPY_ITEMS) {
			return {
				title: 'Large copy',
				description: `This creates ${total_items.toLocaleString()} items. The copy runs in the background and can take a moment.`
			};
		}
		return null;
	});

	function resetForm() {
		copy_value = 1;
	}

	function closeDialog() {
		resetForm();
		open_dialog = false;
	}

	function setCount(value: number) {
		copy_value = countFromInput(value);
	}

	/**
	 * Hands the copy to the background: the dialog closes at once, a loading
	 * toast tracks the job, and the copy itself yields between slices (see
	 * `copyAndAddNodesById`), so the app stays usable while it runs.
	 */
	async function handleMultiCopy(target_node_id: string) {
		if (!is_valid) return;

		const count = copy_count;
		const name = node_name;
		const label = `${count} ${count === 1 ? 'copy' : 'copies'} of ${name}`;
		const toast_id = toast.loading(`Copying ${label}…`);
		closeDialog();

		const created_nodes = await copyAndAddNodesById(target_node_id, count);
		if (created_nodes.length !== count) {
			toast.error(`Could not copy ${name}.`, { id: toast_id });
			return;
		}

		undo_redo_state.setActionToUndo({
			action: 'batch_copy_node',
			batch_data: created_nodes.map((node) => ({
				data: node as unknown as PhaseLoadSchedule,
				children_nodes: []
			}))
		});
		toast.success(`${label} added`, { id: toast_id });
	}
</script>

<Dialog.Root
	bind:open={open_dialog}
	onOpenChange={(open) => {
		if (!open) resetForm();
	}}
>
	<Dialog.Content class="sm:max-w-108">
		<Dialog.Header>
			<Dialog.Title>Copy {node_name}</Dialog.Title>
			<Dialog.Description>
				Adds copies next to the original.
				{#if descendant_count > 0}
					Each copy includes {descendant_count.toLocaleString()}
					{descendant_count === 1 ? 'item' : 'items'}.
				{/if}
			</Dialog.Description>
		</Dialog.Header>

		<form
			id="copy-form"
			class="mt-5 grid gap-5"
			onsubmit={(event) => {
				event.preventDefault();
				void handleMultiCopy(node_id);
			}}
		>
			<div class="grid gap-2">
				<div class="flex items-center justify-between gap-3">
					<Label for="copy_count">Number of copies</Label>
					<span class="text-xs text-muted-foreground tabular-nums">
						Up to {MAX_COPY_COUNT.toLocaleString()}
					</span>
				</div>

				<div class="flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="icon-lg"
						aria-label="Decrease copies"
						disabled={stepper_count <= 1}
						onclick={() => setCount(stepper_count - 1)}
					>
						<MinusIcon />
					</Button>
					<Input
						id="copy_count"
						type="number"
						min={1}
						max={MAX_COPY_COUNT}
						step={1}
						inputmode="numeric"
						bind:value={copy_value}
						invalid={!is_valid}
						aria-describedby="copy-count-help"
						onfocus={(event) => event.currentTarget.select()}
						class="h-10 flex-1 [appearance:textfield] text-center text-lg font-semibold tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
					/>
					<Button
						type="button"
						variant="outline"
						size="icon-lg"
						aria-label="Increase copies"
						disabled={stepper_count >= MAX_COPY_COUNT}
						onclick={() => setCount(stepper_count + 1)}
					>
						<PlusIcon />
					</Button>
				</div>

				<p id="copy-count-help" class="text-xs text-muted-foreground" aria-live="polite">
					{#if is_too_large}
						Too large: at most {max_copies.toLocaleString()}
						{max_copies === 1 ? 'copy' : 'copies'} of this item fit in one copy.
					{:else if !is_valid}
						Enter a whole number from 1 to {MAX_COPY_COUNT.toLocaleString()}.
					{:else}
						{total_items.toLocaleString()}
						{total_items === 1 ? 'item' : 'items'} will be added.
					{/if}
				</p>
			</div>

			{#if heavy_copy}
				<Alert.Root variant="warning" class="items-start">
					<WarningCircleIcon class="mt-0.5 size-4 shrink-0" />
					<Alert.Description>
						<span class="font-medium">{heavy_copy.title}.</span>
						{heavy_copy.description}
					</Alert.Description>
				</Alert.Root>
			{/if}
		</form>

		<Dialog.Footer>
			<Button type="button" variant="ghost" onclick={closeDialog}>Cancel</Button>
			<Button type="submit" form="copy-form" disabled={!is_valid}>
				{is_valid ? `Copy ${copy_count}` : 'Copy'}
			</Button>
		</Dialog.Footer>
		<Dialog.Close />
	</Dialog.Content>
</Dialog.Root>
