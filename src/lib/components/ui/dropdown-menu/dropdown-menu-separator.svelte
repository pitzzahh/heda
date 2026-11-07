<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils/index.js';

	let { class: classProp, ...rest }: { class?: string } & HTMLAttributes<HTMLHRElement> = $props();
</script>

<hr
	{...rest}
	data-slot="dropdown-menu-separator"
	class={cn('bg-border -mx-1 my-1 h-px border-0', classProp)}
/>
