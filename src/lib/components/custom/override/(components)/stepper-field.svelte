<script lang="ts" module>
	interface Props {
		selected_value: string | number | undefined;
		is_overridden: boolean;
		on_decrement: () => void;
		on_increment: () => void;
		on_remove_override: () => void;
	}
</script>

<script lang="ts">
	import { CaretDownIcon, CaretUpIcon } from '#lib/assets/icons/index.js';
	import RemoveOverrideButton from './remove-override-button.svelte';

	let { selected_value, is_overridden, on_decrement, on_increment, on_remove_override }: Props =
		$props();
</script>

<div class="w-full space-y-1.5">
	<div class="flex items-center gap-1.5">
		<button
			class="border-border bg-muted text-muted-foreground hover:bg-muted/70 flex h-8 w-12 shrink-0 cursor-pointer items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40"
			onclick={() => on_decrement()}
			aria-label="Decrease value"
		>
			<CaretDownIcon class="size-3" />
		</button>
		<div class="min-w-0 flex-1 truncate text-center text-base font-semibold">
			{selected_value ?? '—'}
			{#if is_overridden}
				<span class="text-primary ml-1 align-middle text-[10px] font-semibold">(Override)</span>
			{/if}
		</div>
		<button
			class="border-border bg-muted text-muted-foreground hover:bg-muted/70 flex h-8 w-12 shrink-0 cursor-pointer items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40"
			onclick={() => on_increment()}
			aria-label="Increase value"
		>
			<CaretUpIcon class="size-3" />
		</button>
	</div>

	{#if is_overridden}
		<div class="flex justify-end">
			<RemoveOverrideButton on_remove={on_remove_override} />
		</div>
	{/if}
</div>
