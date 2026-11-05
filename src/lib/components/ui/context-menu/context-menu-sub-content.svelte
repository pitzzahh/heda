<script lang="ts">
	import { ContextMenu as ContextMenuPrimitive } from 'bits-ui';
	import { getContext } from 'svelte';
	import { cn } from '#lib/utils';
	import { type MenuSize, menu } from '#lib/components/ui/shared/menu';
	import { ANCHORED } from '#lib/components/ui/shared/anchor';

	let {
		class: classProp,
		size = 'default',
		...rest
	}: ContextMenuPrimitive.SubContentProps & { size?: MenuSize } = $props();

	const sub = getContext<{ close: () => void } | undefined>('context-menu-sub');
</script>

<ContextMenuPrimitive.Portal>
	<ContextMenuPrimitive.SubContent
		escapeKeydownBehavior={sub ? 'ignore' : 'close'}
		onkeydown={(event: KeyboardEvent) => {
			if (event.key !== 'Escape' || !sub) return;
			event.stopPropagation();
			const id = (event.currentTarget as HTMLElement).id;
			sub.close();
			document.querySelector<HTMLElement>(`[aria-controls="${id}"]`)?.focus();
		}}
		{...rest}
		data-slot="context-menu-sub-content"
		data-size={size}
		class={cn(ANCHORED, 'static min-w-40', menu({ size }).surface(), classProp)}
	/>
</ContextMenuPrimitive.Portal>
