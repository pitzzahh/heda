<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils/index.js';
	import { getCommand } from './context.js';

	let { class: classProp, children, ...rest }: HTMLAttributes<HTMLDivElement> = $props();
	const command = getCommand();
</script>

<!-- Key hints along the bottom, e.g. move, open and close. -->
<div {...rest} data-slot="command-footer" class={cn(command.styles.footer(), classProp)}>
	{@render children?.()}
</div>
