<script lang="ts" module>
	interface Props {
		current_parent_id: string;
		selected_parent: { name: string; id: string } | null;
		excluded_node_id: string;
		onselect?: (parent: { name: string; id: string }) => void;
	}
</script>

<script lang="ts">
	import { CaretUpDownIcon, CheckIcon } from '#lib/assets/icons/index.js';
	import * as Popover from '#lib/components/ui/popover/index.js';
	import * as Command from '#lib/components/ui/command/index.js';
	import { buttonVariants } from '#lib/components/ui/button/index.js';
	import { cn } from '#lib/utils/index.js';
	import { getParentNodes } from '#lib/db/queries/index.js';

	let { current_parent_id, selected_parent, excluded_node_id, onselect, ...props }: Props =
		$props();

	let is_popover_open = $state(false);
	const parent_nodes = $derived(getParentNodes(excluded_node_id));
</script>

<Popover.Root bind:open={is_popover_open}>
	<Popover.Trigger
		class={cn(buttonVariants({ variant: 'outline' }), 'min-w-[150px]  justify-between')}
		role="combobox"
		{...props}
	>
		{selected_parent?.name ?? 'Select a parent panel'}
		<CaretUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
	</Popover.Trigger>

	<Popover.Content class="w-auto min-w-[150px] p-0">
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
