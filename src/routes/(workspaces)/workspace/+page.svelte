<script lang="ts">
	import { LightningAIcon, TableIcon } from '#lib/assets/icons';

	const shortcuts = [
		{ keys: ['Ctrl', 'S'], label: 'Save the project' },
		{ keys: ['Alt', 'Click'], label: 'Mark a unit for deletion' }
	] as const;
</script>

<div class="grid h-full w-full place-content-center p-6">
	<div
		class="border-border bg-card/60 grid w-full max-w-md place-items-center gap-5 rounded-3xl border border-dashed px-8 py-10 text-center shadow-[var(--surface-shadow)]"
	>
		<div class="relative">
			<div
				class="border-border bg-muted/50 text-muted-foreground grid size-20 place-items-center rounded-2xl border"
			>
				<TableIcon class="size-9" />
			</div>
			<div
				class="bg-primary text-primary-foreground border-background absolute -right-2 -bottom-2 grid size-7 place-items-center rounded-lg border"
			>
				<LightningAIcon class="size-4" />
			</div>
		</div>

		<div class="grid gap-1.5">
			<h2 class="text-lg font-bold tracking-tight">No load schedule selected</h2>
			<p class="text-muted-foreground text-sm leading-6 text-balance">
				Pick a unit from the hierarchy on the left to inspect its load schedule and voltage drop.
			</p>
		</div>

		<div class="divide-border/70 border-border/70 w-full divide-y rounded-xl border">
			{#each shortcuts as shortcut (shortcut.label)}
				<div class="flex items-center justify-between gap-4 px-4 py-2.5">
					<span class="text-muted-foreground text-xs">{shortcut.label}</span>
					<span class="flex items-center gap-1">
						{#each shortcut.keys as key, i (key)}
							{#if i > 0}<span class="text-muted-foreground text-[10px]">+</span>{/if}
							<kbd
								class="border-border bg-muted text-foreground rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold shadow-[0_1px_0_0_var(--border)]"
							>
								{key}
							</kbd>
						{/each}
					</span>
				</div>
			{/each}
		</div>
	</div>
</div>
