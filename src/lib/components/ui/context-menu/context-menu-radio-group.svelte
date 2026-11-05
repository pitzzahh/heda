<script lang="ts">
	import { ContextMenu as ContextMenuPrimitive } from 'bits-ui';

	let { value = $bindable(''), ...rest }: ContextMenuPrimitive.RadioGroupProps = $props();
</script>

<ContextMenuPrimitive.RadioGroup bind:value {...rest} data-slot="context-menu-radio-group" />
