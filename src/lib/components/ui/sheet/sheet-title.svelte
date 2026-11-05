<script lang="ts">
	import { Dialog as SheetPrimitive } from 'bits-ui';
	import { cn } from '#lib/utils';

	let { class: classProp, ...rest }: SheetPrimitive.TitleProps = $props();
</script>

<SheetPrimitive.Title
	{...rest}
	data-slot="sheet-title"
	class={cn('text-foreground text-sm font-semibold', classProp)}
/>
