<script lang="ts">
	import { standard_ampere_ratings } from '@/constants';
	import { ArrowUp, ArrowDown } from 'svelte-radix';
	import { Button } from '@/components/ui/button/index.js';
	import { overrideField } from '@/db/mutations';
	import { invalidateAll } from '$app/navigation';

	let {
		node_id,
		closeDialog,
		current_at
	}: { current_at: number; node_id: string; closeDialog: () => void } = $props();

	let default_index = standard_ampere_ratings.findIndex((rating) => current_at === rating);
	let current_index = $state(default_index);
	let selected_rating = $derived(standard_ampere_ratings.at(current_index));
	const last_index = standard_ampere_ratings.length - 1;

	function handleIncrement() {
		if (current_index === last_index) {
			current_index = 0;
			return;
		}

		current_index += 1;
	}

	function handleDecrement() {
		if (current_index === 0) {
			current_index = last_index;
			return;
		}

		current_index -= 1;
	}

	async function handleOverride() {
		if (selected_rating) {
			await overrideField({ node_id, field_data: selected_rating, field_type: 'at' });
			await invalidateAll();
			closeDialog();
		}
	}
</script>

<div class="flex w-full flex-col gap-4">
	<div class="flex w-full items-center justify-center gap-2">
		<Button class="h-8 w-full max-w-8" size="icon" onclick={handleDecrement}>
			<ArrowDown class="size-4" />
		</Button>
		<p class="w-full min-w-12 border py-1 text-center">
			{selected_rating}
		</p>
		<Button class="h-8 w-full max-w-8" size="sm" onclick={handleIncrement}>
			<ArrowUp class="size-4" />
		</Button>
	</div>

	<Button class="w-full" onclick={handleOverride}>Override</Button>
</div>
