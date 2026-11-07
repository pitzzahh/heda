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
	import { Label } from '#lib/components/ui/label/index.js';
	import RemoveOverrideButton from './remove-override-button.svelte';

	let { selected_value, is_overridden, on_decrement, on_increment, on_remove_override }: Props =
		$props();
</script>

<div class="grid w-26 grid-cols-[1fr_auto] grid-rows-[auto_auto_auto_auto] items-center gap-x-1.5">
	<Label class="text-muted-foreground col-span-2 text-left text-[11px] font-medium">
		{selected_value}
		{#if is_overridden}
			<span class="text-primary text-[10px] font-semibold">(Override)</span>
		{/if}
	</Label>

	<div class="flex w-full gap-0.5">
		<button
			class="border-border bg-muted text-muted-foreground hover:bg-muted/70 flex h-6 flex-1 cursor-pointer items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40"
			onclick={() => on_decrement()}
			aria-label="Decrease value"
		>
			<CaretDownIcon class="size-3" />
		</button>
		<button
			class="border-border bg-muted text-muted-foreground hover:bg-muted/70 flex h-6 flex-1 cursor-pointer items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40"
			onclick={() => on_increment()}
			aria-label="Increase value"
		>
			<CaretUpIcon class="size-3" />
		</button>
	</div>

	{#if is_overridden}
		<div class="row-span-2">
			<RemoveOverrideButton on_remove={on_remove_override} />
		</div>
	{/if}
</div>
