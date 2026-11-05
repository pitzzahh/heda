<script lang="ts">
	import { ContextMenu as ContextMenuPrimitive } from 'bits-ui';
	import { cn } from '#lib/utils';

	let { class: classProp, ...rest }: ContextMenuPrimitive.TriggerProps = $props();
</script>

<ContextMenuPrimitive.Trigger
	{...rest}
	data-slot="context-menu-trigger"
	class={cn('contents', classProp)}
/>
