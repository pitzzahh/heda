<script lang="ts" module>
	interface Props {
		current_parent_id: string;
		selected_parent: { name: string; id: string };
		excluded_node_id: string;
	}
</script>

<script lang="ts">
	import { CaretUpDownIcon, CheckIcon } from '#lib/assets/icons';
	import * as Popover from '#lib/components/ui/popover/index.js';
	import * as Command from '#lib/components/ui/command/index.js';
	import { buttonVariants } from '#lib/components/ui/button';
	import { cn } from '#lib/utils';
	import { getParentNodes } from '#lib/db/queries';

	let {
		current_parent_id,
		selected_parent = $bindable(),
		excluded_node_id,
		...props
	}: Props = $props();

	let is_popover_open = $state(false);
</script>

{#await getParentNodes(excluded_node_id) then parent_nodes}
	<Popover.Root bind:open={is_popover_open}>
		<Popover.Trigger
			class={cn(buttonVariants({ variant: 'outline' }), 'min-w-[150px]  justify-between')}
			role="combobox"
			{...props}
		>
			{selected_parent.name}
			<CaretUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
		</Popover.Trigger>

		<Popover.Content class="w-auto min-w-[150px] p-0">
			<Command.Root>
				<Command.Input autofocus placeholder="Search a parent panel..." class="h-9" />
				<Command.Empty>No parent panel found.</Command.Empty>
				<Command.Group>
					{#each parent_nodes as parent_node (parent_node?.id)}
						<Command.Item
							value={parent_node?.name ?? ''}
							onSelect={() => {
								if (parent_node) selected_parent = parent_node;
								is_popover_open = false;
							}}
							class={parent_node?.id === current_parent_id
								? 'text-primary! hover:text-primary!'
								: undefined}
						>
							{parent_node?.name}
							{#if parent_node?.id === selected_parent.id}
								<CheckIcon class="ml-auto size-4" />
							{/if}
						</Command.Item>
					{/each}
				</Command.Group>
			</Command.Root>
		</Popover.Content>
	</Popover.Root>
{/await}
