<script module>
	import { Pencil, CirclePlus, Grid2x2Plus, Trash2, Copy } from '@/assets/icons';

	export { Grid2x2PlusIcon, CirclePlusIcon, PencilIcon, CopyIcon, Trash2Icon };
</script>

{#snippet Grid2x2PlusIcon(/** @type {string} */ className)}
	<Grid2x2Plus class={className} />
{/snippet}

{#snippet CirclePlusIcon(/** @type {string} */ className)}
	<CirclePlus class={className} />
{/snippet}

{#snippet PencilIcon(/** @type {string} */ className)}
	<Pencil class={className} />
{/snippet}

{#snippet CopyIcon(/** @type {string} */ className)}
	<Copy class={className} />
{/snippet}

{#snippet Trash2Icon(/** @type {string} */ className)}
	<Trash2 class={className} />
{/snippet}
