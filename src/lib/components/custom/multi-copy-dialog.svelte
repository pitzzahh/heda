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
	import * as Dialog from '@/components/ui/dialog/index.js';
	import * as Alert from '@/components/ui/alert/index.js';
	import { toast } from 'svelte-sonner';
	import { invalidate } from '$app/navigation';
	import { getUndoRedoState } from '@/hooks/undo-redo.svelte';
	import { copyAndAddNodeById } from '@/db/mutations';
	import { getNumberOfChildren } from '@/db/queries';
	import type { PhaseLoadSchedule } from '@/types/load/one_phase';
	import { CircleAlert, Loader } from 'lucide-svelte';
	import { Input } from '@/components/ui/input/index.js';
	import { Label } from '@/components/ui/label/index.js';
	import { cn } from '@/utils';
	import Button from '../ui/button/button.svelte';
	import { getProjectState } from '@/hooks/project-state.svelte';

	let { open_dialog = $bindable(false), node_name, node_id }: Props = $props();
	let multi_copy = $state<MultiCopy>({
		valid: true,
		value: 1,
		processing: false,
		might_take_long: false
	});
	const undo_redo_state = getUndoRedoState();
	const project_state = getProjectState();

	async function handleMultiCopy(node_id: string) {
		if (!multi_copy.valid) {
			return toast.warning('Invalid copy count, must be greater than 0');
		}
		multi_copy.processing = true;
		const copy_count = Number(multi_copy.value);
		let latest_node = await copyAndAddNodeById(project_state.current_project_name, node_id);

		if (latest_node) {
			if (latest_node.node_type === 'panel') {
				// check if might_take_some_time
				const child_count = await getNumberOfChildren(node_id);
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
				latest_node = await copyAndAddNodeById(project_state.current_project_name, latest_node.id);

				if (!latest_node) {
					multi_copy.processing = false;
					return toast.error('An error occurred while copying nodes.');
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
			await invalidate('app:workspace').then(() => invalidate('app:workspace/load-schedule'));
			return toast.success(`[${copy_count}]: ${node_name} copied successfully`);
		} else {
			multi_copy.processing = false;
			return toast.error('Failed to copy the initial node.');
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
				<CircleAlert class="size-4" />
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
					'border-red-600 ring ring-red-600 outline-red-600': !multi_copy.valid
				})}
			/>
		</div>
		<Dialog.Footer>
			<Button type="submit" onclick={() => handleMultiCopy(node_id)}>
				<Loader
					class={cn('mr-1 hidden h-4 w-4 animate-spin', {
						block: multi_copy.processing
					})}
				/>
				<span>Copy</span>
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
