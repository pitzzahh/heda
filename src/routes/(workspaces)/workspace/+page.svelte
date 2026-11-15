<script lang="ts">
	import { LightningAIcon, TableIcon } from '#lib/assets/icons/index.js';

	const shortcuts = [
		{ keys: ['Ctrl', 'S'], label: 'Save the project' },
		{ keys: ['Alt', 'Click'], label: 'Mark a unit for deletion' }
	] as const;
</script>

<div class="grid h-full w-full place-content-center p-6">
	<div
		class="grid w-full max-w-md place-items-center gap-5 rounded-3xl border border-dashed border-border bg-card/60 px-8 py-10 text-center shadow-[var(--surface-shadow)]"
	>
		<div class="relative">
			<div
				class="grid size-20 place-items-center rounded-2xl border border-border bg-muted/50 text-muted-foreground"
			>
				<TableIcon class="size-9" />
			</div>
			<div
				class="absolute -right-2 -bottom-2 grid size-7 place-items-center rounded-lg border border-background bg-primary text-primary-foreground"
			>
				<LightningAIcon class="size-4" />
			</div>
		</div>

		<div class="grid gap-1.5">
			<h2 class="text-lg font-bold tracking-tight">No load schedule selected</h2>
			<p class="text-sm leading-6 text-balance text-muted-foreground">
				Pick a unit from the hierarchy on the left to inspect its load schedule and voltage drop.
			</p>
		</div>

		<div class="w-full divide-y divide-border/70 rounded-xl border border-border/70">
			{#each shortcuts as shortcut (shortcut.label)}
				<div class="flex items-center justify-between gap-4 px-4 py-2.5">
					<span class="text-xs text-muted-foreground">{shortcut.label}</span>
					<span class="flex items-center gap-1">
						{#each shortcut.keys as key, i (key)}
							{#if i > 0}<span class="text-[10px] text-muted-foreground">+</span>{/if}
							<kbd
								class="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground shadow-[0_1px_0_0_var(--border)]"
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
