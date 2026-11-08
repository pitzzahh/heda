<script module lang="ts">
	type MultiCopy = {
		valid: boolean;
		value: number;
		processing: boolean;
		might_take_long: boolean;
		error?: string;
	};

	type Props = { open_dialog: boolean; node_name: string; node_id: string };
</script>

<script lang="ts">
	import { CircleNotchIcon, WarningCircleIcon } from '#lib/assets/icons/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { toast } from 'svelte-sonner';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import { copyAndAddNodeById } from '#lib/db/mutations/index.js';
	import { tick } from 'svelte';
	import { getNumberOfChildren } from '#lib/db/queries/index.js';
	import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { cn } from '#lib/utils/index.js';
	import Button from '../ui/button/button.svelte';

	let { open_dialog = $bindable(false), node_name, node_id }: Props = $props();
	let multi_copy = $state<MultiCopy>({
		valid: true,
		value: 1,
		processing: false,
		might_take_long: false
	});
	let undo_redo_state = getUndoRedoState();

	async function handleMultiCopy(node_id: string) {
		if (!multi_copy.valid) {
			return toast.warning('Invalid copy count, must be greater than 0');
		}
		const toast_id = toast.loading(`Copying ${multi_copy.value} ${node_name}...`);
		multi_copy.processing = true;
		// Let the spinner paint before the synchronous copy work starts.
		await tick();
		const copy_count = Number(multi_copy.value);
		let latest_node = await copyAndAddNodeById(node_id);

		if (latest_node) {
			if (latest_node.node_type === 'panel') {
				// check if might_take_some_time
				const child_count = getNumberOfChildren(node_id);
				multi_copy.might_take_long = child_count >= 15;
			} else if (latest_node.node_type === 'load') {
				// check if might_take_some_time
				multi_copy.might_take_long = copy_count >= 15;
			}

			let batch_data = [] as {
				data: PhaseLoadSchedule;
				children_nodes?: PhaseLoadSchedule[];
			}[];

			batch_data = [
				...batch_data,
				{ data: latest_node as unknown as PhaseLoadSchedule, children_nodes: [] }
			];

			for (let i = 1; i < copy_count; i++) {
				// Yield so the dialog stays responsive on deep hierarchies.
				await new Promise((resolve) => setTimeout(resolve, 0));
				latest_node = await copyAndAddNodeById(latest_node.id);

				if (!latest_node) {
					multi_copy.processing = false;
					return toast.error('An error occurred while copying nodes.', { id: toast_id });
				}

				batch_data = [
					...batch_data,
					{ data: latest_node as unknown as PhaseLoadSchedule, children_nodes: [] }
				];
			}

			undo_redo_state.setActionToUndo({
				action: 'batch_copy_node',
				batch_data
			});

			multi_copy.processing = false;
			open_dialog = false;
			toast.success(`[${copy_count}]: ${node_name} copied successfully`, {
				id: toast_id
			});
		} else {
			multi_copy.processing = false;
			console.warn('Failed to copy the initial node.');
			return toast.error('Failed to copy the initial node.', { id: toast_id });
		}
	}
</script>

<Dialog.Root bind:open={open_dialog}>
	<Dialog.Content class="sm:max-w-[425px]">
		<Dialog.Header>
			<Dialog.Title>Copy {node_name}</Dialog.Title>
			<Dialog.Description>Specify the number of {node_name} to be copied.</Dialog.Description>
		</Dialog.Header>
		{#if !multi_copy.valid}
			<Alert.Root variant="warning">
				<WarningCircleIcon class="size-4" />
				<Alert.Description
					>{multi_copy.error ?? 'Invalid copy count, must be greater than 0'}.</Alert.Description
				>
			</Alert.Root>
		{/if}
		<div class="grid grid-cols-4 items-center gap-4">
			<Label for="copy_count" class="text-right">Copy count</Label>
			<Input
				id="copy_count"
				type="number"
				placeholder="Enter the circuit number"
				bind:value={multi_copy.value}
				class={cn('col-span-3', {
					'border-destructive ring-destructive outline-destructive ring-3': !multi_copy.valid
				})}
			/>
		</div>
		<Dialog.Footer>
			<Button type="submit" onclick={() => handleMultiCopy(node_id)}>
				<CircleNotchIcon
					class={cn('mr-1 hidden h-4 w-4 animate-spin', {
						block: multi_copy.processing
					})}
				/>
				<span>Copy</span>
			</Button>
		</Dialog.Footer>
		<Dialog.Close />
	</Dialog.Content>
</Dialog.Root>
