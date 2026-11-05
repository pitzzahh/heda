<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { cn } from '#lib/utils';

	let { class: classProp, ...rest }: DialogPrimitive.TitleProps = $props();
</script>

<DialogPrimitive.Title
	{...rest}
	data-slot="dialog-title"
	class={cn(
		'text-foreground [&>svg]:text-muted-foreground flex items-center gap-2 text-lg font-semibold [&>svg]:size-5',
		classProp
	)}
/>
