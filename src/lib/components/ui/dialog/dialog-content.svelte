<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import { cn } from '#lib/utils/index.js';
	import { isCompactViewport } from '#lib/helpers/platform.js';
	import { dialogFrame, dialogWidth } from './variants.js';
	import { getDialog } from './context.js';

	let { children, class: classProp }: { children?: Snippet; class?: string } = $props();

	const dialog = getDialog();
	const styles = $derived(dialogFrame({ motion: dialog.motion, variant: dialog.variant }));
</script>

<DialogPrimitive.Portal>
	<DialogPrimitive.Overlay
		data-slot="dialog-backdrop"
		aria-hidden="true"
		class={styles.backdrop()}
	/>
	<DialogPrimitive.Content
		data-slot="dialog-content"
		data-motion={dialog.motion}
		data-variant={dialog.variant}
		onOpenAutoFocus={(event) => {
			if (isCompactViewport()) event.preventDefault();
		}}
		onInteractOutside={(event) => {
			if (!dialog.dismissOnBackdrop) event.preventDefault();
		}}
		class={cn(
			styles.popup(),
			styles.panel(),
			'w-[min(32rem,calc(100vw-2rem))]',
			dialogWidth({ size: dialog.size }),
			classProp,
			styles.drawer()
		)}
	>
		{#if dialog.variant === 'framed'}
			<!-- Inset frame: the body sits on a lighter surface, the footer in the rim below it. -->
			<div class={styles.body()}>
				{#if dialog.header}
					<div data-slot="dialog-header" class={cn(styles.header(), dialog.header.class)}>
						{@render dialog.header.children?.()}
					</div>
				{/if}
				<div data-slot="dialog-scroll" class={styles.scroll()}>
					{@render children?.()}
				</div>
			</div>
			{#if dialog.footer}
				<div
					data-slot="dialog-footer"
					class={cn(dialogFrame({ variant: dialog.variant }).footer(), dialog.footer.class)}
				>
					{@render dialog.footer.children?.()}
				</div>
			{/if}
		{:else}
			{#if dialog.header}
				<div data-slot="dialog-header" class={cn(styles.header(), dialog.header.class)}>
					{@render dialog.header.children?.()}
				</div>
			{/if}
			<div data-slot="dialog-scroll" class={styles.scroll()}>
				{@render children?.()}
			</div>
			{#if dialog.footer}
				<div
					data-slot="dialog-footer"
					class={cn(dialogFrame({ variant: dialog.variant }).footer(), dialog.footer.class)}
				>
					{@render dialog.footer.children?.()}
				</div>
			{/if}
		{/if}
	</DialogPrimitive.Content>
</DialogPrimitive.Portal>
