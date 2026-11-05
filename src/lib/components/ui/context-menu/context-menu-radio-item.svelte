<script lang="ts">
	import { ContextMenu as ContextMenuPrimitive } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import { cn } from '#lib/utils';
	import { menu } from '#lib/components/ui/shared/menu';

	let {
		class: classProp,
		children: label,
		closeOnSelect = false,
		...rest
	}: Omit<ContextMenuPrimitive.RadioItemProps, 'children'> & {
		children?: Snippet;
	} = $props();

	const styles = menu();
</script>

<ContextMenuPrimitive.RadioItem
	{closeOnSelect}
	{...rest}
	data-slot="context-menu-radio-item"
	data-inset=""
	class={cn(styles.item(), classProp)}
>
	{#snippet children({ checked })}
		<span class={styles.indicator()}>
			<span data-on={checked} class={styles.dot()}></span>
		</span>
		{@render label?.()}
	{/snippet}
</ContextMenuPrimitive.RadioItem>
