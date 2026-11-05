<script lang="ts">
	import { Popover as PopoverPrimitive } from 'bits-ui';
	import { cn } from '#lib/utils';

	let { class: classProp, ...rest }: PopoverPrimitive.TriggerProps = $props();
</script>

<PopoverPrimitive.Trigger
	{...rest}
	data-slot="popover-trigger"
	class={cn(
		'focus-visible:ring-ring inline-flex rounded-lg outline-hidden focus-visible:ring-2',
		classProp
	)}
/>
