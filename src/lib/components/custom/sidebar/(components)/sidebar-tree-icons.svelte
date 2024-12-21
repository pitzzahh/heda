<script module>
	import { Pencil, CirclePlus, Grid2x2Plus, Trash2, Copy } from '@/assets/icons';

	export { Grid2x2PlusIcon, CirclePlusIcon, PencilIcon, CopyIcon, Trash2Icon };
</script>

{#snippet Grid2x2PlusIcon(/** @type {string | undefined} */ className)}
	<Grid2x2Plus class={className} />
{/snippet}

{#snippet CirclePlusIcon(/** @type {string | undefined} */ className)}
	<CirclePlus class={className} />
{/snippet}

{#snippet PencilIcon(/** @type {string | undefined} */ className)}
	<Pencil class={className} />
{/snippet}

{#snippet CopyIcon(/** @type {string | undefined} */ className)}
	<Copy class={className} />
{/snippet}

{#snippet Trash2Icon(/** @type {string | undefined} */ className)}
	<Trash2 class={className} />
{/snippet}
