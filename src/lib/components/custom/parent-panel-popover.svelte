<script lang="ts" module>
	type ParentChoice = { name: string; id: string };

	interface Props {
		current_parent_id: string;
		selected_parent: ParentChoice | null;
		excluded_node_id: string;
		onselect?: (parent: ParentChoice) => void;
	}
</script>

<script lang="ts">
	import { CaretUpDownIcon, CheckIcon } from '#lib/assets/icons.js';
	import * as Popover from '#lib/components/ui/popover/index.js';
	import * as Command from '#lib/components/ui/command/index.js';
	import { buttonVariants } from '#lib/components/ui/button/index.js';
	import { cn } from '#lib/utils/index.js';
	import { getParentNodes } from '#lib/db/queries/index.js';

	let { current_parent_id, selected_parent, excluded_node_id, onselect, ...props }: Props =
		$props();

	let is_popover_open = $state(false);
	let parent_nodes = $state<ParentChoice[]>([]);

	// Asked on every open, so the list follows edits made since the last one.
	async function loadParents(open: boolean) {
		if (open) parent_nodes = await getParentNodes(excluded_node_id);
	}
</script>

<Popover.Root bind:open={is_popover_open} onOpenChange={loadParents}>
	<Popover.Trigger
		class={cn(buttonVariants({ variant: 'outline' }), 'min-w-37.5  justify-between')}
		role="combobox"
		{...props}
	>
		{selected_parent?.name ?? 'Select a parent panel'}
		<CaretUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
	</Popover.Trigger>

	<Popover.Content class="w-auto min-w-37.5 p-0">
		<Command.Root>
			<Command.Input autofocus placeholder="Search a parent panel..." class="h-9" />
			<Command.Empty>No parent panel found.</Command.Empty>
			<Command.Group>
				{#each parent_nodes as parent_node (parent_node.id)}
					<Command.Item
						value={parent_node.name}
						onSelect={() => {
							onselect?.(parent_node);
							is_popover_open = false;
						}}
						class={parent_node.id === current_parent_id
							? 'text-primary! hover:text-primary!'
							: undefined}
					>
						{parent_node.name}
						{#if parent_node.id === selected_parent?.id}
							<CheckIcon class="ml-auto size-4" />
						{/if}
					</Command.Item>
				{/each}
			</Command.Group>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
