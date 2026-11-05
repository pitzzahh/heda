<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLLabelAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils';

	let {
		children,
		for: htmlFor,
		class: classProp,
		required = false,
		disabled = false,
		ref = $bindable(null),
		...rest
	}: Omit<HTMLLabelAttributes, 'class' | 'for' | 'children'> & {
		children?: Snippet;
		for?: string;
		class?: string;
		required?: boolean;
		disabled?: boolean;
		ref?: HTMLLabelElement | null;
	} = $props();
</script>

<label
	bind:this={ref}
	data-slot="label"
	{...rest}
	for={htmlFor}
	class={cn(
		'text-foreground inline-flex items-center gap-1 text-sm font-medium',
		disabled && 'pointer-events-none opacity-50',
		classProp
	)}
>
	{@render children?.()}
	{#if required}<span aria-hidden="true" class="text-destructive-strong">*</span>{/if}
</label>
