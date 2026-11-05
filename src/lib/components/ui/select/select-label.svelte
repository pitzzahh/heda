<script lang="ts">
	import { Select as SelectPrimitive } from 'bits-ui';
	import { cn } from '#lib/utils';

	let { class: classProp, ...rest }: SelectPrimitive.GroupHeadingProps = $props();
</script>

<SelectPrimitive.GroupHeading
	{...rest}
	data-slot="select-label"
	class={cn('text-muted-foreground px-2.5 py-1.5 text-xs font-medium', classProp)}
/>
