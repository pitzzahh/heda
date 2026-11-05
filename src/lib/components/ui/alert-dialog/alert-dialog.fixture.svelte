<script lang="ts" module>
	interface Props {
		open?: boolean;
	}
</script>

<script lang="ts">
	import * as AlertDialog from './index.js';

	let { open = $bindable(false) }: Props = $props();
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Trigger>Delete project</AlertDialog.Trigger>
	<AlertDialog.Content>
		<AlertDialog.Title>Confirm delete</AlertDialog.Title>
		<AlertDialog.Description>This cannot be undone.</AlertDialog.Description>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action>Delete</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
