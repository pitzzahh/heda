<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import { cn } from '#lib/utils';
	import { dropdownMenuTrigger } from './context';

	let { class: classProp, ...rest }: DropdownMenuPrimitive.TriggerProps = $props();
</script>

<DropdownMenuPrimitive.Trigger
	id={dropdownMenuTrigger()}
	{...rest}
	data-slot="dropdown-menu-trigger"
	class={cn(
		'focus-visible:ring-ring inline-flex rounded-lg outline-hidden focus-visible:ring-2',
		classProp
	)}
/>
