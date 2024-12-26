<script lang="ts">
	import { cn } from '@/utils';
	import type { WithElementRef } from 'bits-ui';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();

	export { className as class };
</script>

<div bind:this={ref} class={cn('mt-auto flex flex-col gap-2 p-4', className)} {...restProps}>
	{@render children?.()}
</div>
