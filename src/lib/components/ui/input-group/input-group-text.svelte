<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils/index.js';
	import { inputGroup } from './variants.js';

	let {
		ref = $bindable(null),
		class: classProp,
		children,
		...rest
	}: HTMLAttributes<HTMLSpanElement> & { ref?: HTMLSpanElement | null } = $props();
</script>

<span bind:this={ref} class={cn(inputGroup().text(), classProp)} {...rest}>
	{@render children?.()}
</span>
