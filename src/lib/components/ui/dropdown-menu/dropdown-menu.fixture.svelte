<script lang="ts" module>
	interface Props {
		open?: boolean;
	}
</script>

<script lang="ts">
	import * as DropdownMenu from './index.js';

	let { open = $bindable(false) }: Props = $props();
</script>

<DropdownMenu.Root bind:open>
	<DropdownMenu.Trigger>Open menu</DropdownMenu.Trigger>
	<DropdownMenu.Content>
		<DropdownMenu.Item>First item</DropdownMenu.Item>
		<DropdownMenu.Item>Second item</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>
