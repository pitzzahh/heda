<script lang="ts">
	import * as Popover from '@/components/ui/popover/index.js';
	import * as Command from '@/components/ui/command/index.js';
	import { buttonVariants } from '@/components/ui/button';
	import { cn } from '@/utils';
	import { Check, ChevronsUpDown } from 'lucide-svelte';
	import { getParentNodes } from '@/db/queries';

	let {
		current_parent_id,
		selected_parent = $bindable(),
		excluded_node_id,
		...props
	}: {
		current_parent_id: string;
		selected_parent: { name: string; id: string };
		excluded_node_id: string;
	} = $props();
</script>

{#await getParentNodes(excluded_node_id) then parent_nodes}
	<Popover.Root>
		<Popover.Trigger
			class={cn(buttonVariants({ variant: 'outline' }), 'min-w-[150px]  justify-between')}
			role="combobox"
			{...props}
		>
			{selected_parent.name}
			<ChevronsUpDown class="ml-2 size-4 shrink-0 opacity-50" />
		</Popover.Trigger>

		<Popover.Content class="w-auto min-w-[150px] p-0">
			<Command.Root>
				<Command.Input autofocus placeholder="Search a parent panel..." class="h-9" />
				<Command.Empty>No parent panel found.</Command.Empty>
				<Command.Group>
					{#each parent_nodes as parent_node}
						<Command.Item
							value={parent_node?.name}
							onSelect={() => {
								if (parent_node) selected_parent = parent_node;
							}}
							class={parent_node?.id === current_parent_id
								? '!text-primary hover:!text-primary'
								: undefined}
						>
							{parent_node?.name}
							{#if parent_node?.id === selected_parent.id}
								<Check class="ml-auto size-4" />
							{/if}
						</Command.Item>
					{/each}
				</Command.Group>
			</Command.Root>
		</Popover.Content>
	</Popover.Root>
{/await}
