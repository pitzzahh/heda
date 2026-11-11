<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { cn } from '#lib/utils/index.js';

	let { class: classProp, ...rest }: DialogPrimitive.TitleProps = $props();
</script>

<DialogPrimitive.Title
	{...rest}
	data-slot="dialog-title"
	class={cn(
		'text-foreground [&>svg]:text-muted-foreground flex items-center gap-2 text-xl leading-snug font-semibold tracking-tight text-balance [&>svg]:size-5',
		classProp
	)}
/>
