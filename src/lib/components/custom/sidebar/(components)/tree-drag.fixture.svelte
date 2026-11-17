<script lang="ts" module>
	interface Props {
		with_handle: boolean;
	}
</script>

<script lang="ts">
	import { draggable } from '@thisux/sveltednd';

	let { with_handle }: Props = $props();
</script>

<!-- Same shape as a sidebar tree row: the draggable sits inside the row button. -->
<button type="button">
	<div
		data-tree-drag
		use:draggable={{
			container: 'row',
			dragData: { id: 'row' },
			handle: with_handle ? '[data-tree-drag]' : undefined
		}}
	>
		<span id="label">LP-1</span>
	</div>
</button>
