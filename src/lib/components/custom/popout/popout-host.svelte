<script lang="ts" module>
	import type { Snippet } from 'svelte';

	export interface Props {
		title: string;
		/** The popout's body: menus, selects and dialogs must open in this window, not the opener. */
		portal_target: HTMLElement;
		ondock: () => void;
		children: Snippet;
	}
</script>

<script lang="ts">
	import { BitsConfig } from 'bits-ui';
	import { Button } from '#lib/components/ui/button/index.js';
	import { ArrowSquareInIcon } from '#lib/assets/icons.js';

	let { title, portal_target, ondock, children }: Props = $props();
</script>

<BitsConfig defaultPortalTo={portal_target}>
	<div class="flex h-dvh flex-col gap-4 bg-background p-4 text-foreground">
		<header class="flex items-center justify-between gap-3">
			<h1 class="truncate text-sm font-semibold tracking-tight">{title}</h1>
			<Button variant="outline" size="sm" onclick={ondock}>
				<ArrowSquareInIcon />
				Dock back
			</Button>
		</header>
		<div class="flex min-h-0 flex-1 flex-col gap-4">
			{@render children()}
		</div>
	</div>
</BitsConfig>
