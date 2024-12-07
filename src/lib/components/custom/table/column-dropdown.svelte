<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import Button from '@/components/ui/button/button.svelte';
	import { EllipsisIcon } from 'lucide-svelte';
	import { removeNode } from '@/db/mutations';
	import { invalidateAll } from '$app/navigation';

	let { node_id }: { node_id: string } = $props();

	async function handleRemoveLoad() {
		await removeNode(node_id);
		await invalidateAll();
	}
</script>

<div class="grid w-full place-content-center">
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			<Button size="icon" variant="outline">
				<EllipsisIcon class="size-4" />
			</Button>
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end">
			<DropdownMenu.Group>
				<DropdownMenu.GroupHeading>Actions</DropdownMenu.GroupHeading>
				<DropdownMenu.Separator />
				<DropdownMenu.Item>Update</DropdownMenu.Item>
				<DropdownMenu.Item
					onclick={handleRemoveLoad}
					class="text-red-600 hover:!bg-red-600/20 hover:!text-red-600">Remove</DropdownMenu.Item
				>
			</DropdownMenu.Group>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
</div>
