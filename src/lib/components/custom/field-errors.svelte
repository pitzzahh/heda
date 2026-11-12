<script lang="ts" module>
	interface Props {
		errors: readonly string[] | null;
	}
</script>

<script lang="ts">
	import { XCircleIcon } from '#lib/assets/icons/index.js';

	let { errors }: Props = $props();
</script>

{#if errors}
	{#each errors as error (error)}
		<div class="mt-1 flex items-center gap-1.5 text-xs font-medium text-destructive" role="alert">
			<XCircleIcon class="size-3.5 shrink-0" />
			{error}
		</div>
	{/each}
{/if}
