<script lang="ts">
	import { Dialog as SheetPrimitive } from 'bits-ui';
	import { cn } from '#lib/utils/index.js';

	let { class: classProp, ...rest }: SheetPrimitive.DescriptionProps = $props();
</script>

<SheetPrimitive.Description
	{...rest}
	data-slot="sheet-description"
	class={cn('text-sm text-muted-foreground', classProp)}
/>
