<script lang="ts" module>
	let calls: string[] = [];

	export function get_calls() {
		return calls;
	}
</script>

<script lang="ts">
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import { CopyIcon, TrashIcon } from '#lib/assets/icons/index.js';
	import TreeActionsMenu from './tree-actions-menu.svelte';
</script>

<Sidebar.Provider>
	<TreeActionsMenu
		actions={[
			{
				trigger_callback: () => calls.push('copy'),
				variant: 'ghost',
				icon: CopyIcon,
				className: '',
				tooltip_content: 'Copy it'
			},
			{
				trigger_callback: () => calls.push('remove'),
				variant: 'ghost',
				icon: TrashIcon,
				className: '',
				tooltip_content: 'Remove it'
			}
		]}
	/>
</Sidebar.Provider>
