<script lang="ts" module>
	import type { Font, Settings } from '#lib/types/settings/index.js';
</script>

<script lang="ts">
	import { CircleHalfIcon, MoonIcon, SunIcon } from '#lib/assets/icons/index.js';
	import * as RadioGroup from '#lib/components/ui/radio-group/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Separator } from '#lib/components/ui/separator/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import { getSettingsState } from '#lib/hooks/settings-state.svelte.js';
	import { getProjectState } from '#lib/hooks/project-state.svelte.js';
	import { userPrefersMode } from 'mode-watcher';
	import { cn } from '#lib/utils/index.js';

	const themeColors = [
		{ name: 'Autocad', value: 'autocad', bg: 'bg-[#BF2722]' },
		{ name: 'Excel', value: 'excel', bg: 'bg-[#137C4D]' }
	] as const;

	const settingsState = getSettingsState();
	const project_state = getProjectState();
	const selectedFont = $derived(settingsState.font);

	function handleChangeThemeColor(themeColor: Settings['color']) {
		if (settingsState.themeMode) {
			settingsState.setThemeColor(
				themeColor,
				settingsState.themeMode === 'system'
					? userPrefersMode.current === 'dark'
						? 'dark'
						: 'light'
					: settingsState.themeMode
			);
		}
	}
</script>

<div class="flex flex-col gap-4">
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<div class="flex flex-col items-center gap-2">
			<Label class="text-muted-foreground text-[10px] font-semibold tracking-[0.2em] uppercase"
				>Theme</Label
			>
			<RadioGroup.Root value="" class="grid w-full grid-cols-3 gap-2">
				{@render theme_tile('light', 'Light', SunIcon)}
				{@render theme_tile('dark', 'Dark', MoonIcon)}
				{@render theme_tile('system', 'System', CircleHalfIcon)}
			</RadioGroup.Root>
		</div>

		<div class="flex flex-col items-center gap-2">
			<Label class="text-muted-foreground text-[10px] font-semibold tracking-[0.2em] uppercase"
				>Accent</Label
			>
			<div id="colors" class="flex h-full items-center gap-4">
				{#each themeColors as themeColor (themeColor.value)}
					<button
						class="group focus-visible:ring-ring flex cursor-pointer flex-col items-center gap-1.5 rounded-xl p-1.5 outline-hidden transition-colors focus-visible:ring-2"
						onclick={() => handleChangeThemeColor(themeColor.value)}
						aria-label="Use {themeColor.name} accent"
						aria-pressed={themeColor.value === settingsState.themeColor}
					>
						<span
							class={cn(
								themeColor.bg,
								'size-9 rounded-full shadow-inner transition-transform duration-200 group-hover:scale-110',
								{
									'ring-primary ring-offset-background scale-110 ring-2 ring-offset-2':
										themeColor.value === settingsState.themeColor
								}
							)}
						></span>
						<span class="text-muted-foreground text-[10px] font-medium">{themeColor.name}</span>
					</button>
				{/each}
			</div>
		</div>
	</div>
</div>
<Separator class="my-1 w-full" />
<div class="flex flex-row items-center justify-between gap-3">
	<div class="space-y-0.5">
		<Label>Show loads in Unit Hierarchy</Label>
		<p class="text-muted-foreground text-xs">
			Show or hide loads in the unit hierarchy, minimizing the hierarchy view.
		</p>
	</div>
	<Switch
		disabled={!project_state.loaded}
		checked={settingsState.show_loads_on_unit_hierarchy}
		onCheckedChange={(v) => settingsState.setShowLoadsOnUnitHeirarchy(v)}
	/>
</div>
<Separator class="my-1 w-full" />
<div class="flex flex-row items-center justify-between gap-3">
	<div class="space-y-0.5">
		<Label>Enable panel multi copy</Label>
		<p class="text-muted-foreground text-xs">
			Enable this option to prompt for the number of panels to be copied when copying a panel.
		</p>
	</div>
	<Switch
		disabled={!project_state.loaded}
		checked={settingsState.is_panel_multi_copy}
		onCheckedChange={(v) => settingsState.setIsPanelMultiCopy(v)}
	/>
</div>
<Separator class="my-1 w-full" />
<div class="flex flex-row items-center justify-between gap-3">
	<div class="space-y-0.5">
		<Label>Enable load multi copy</Label>
		<p class="text-muted-foreground text-xs">
			Enable this option to prompt for the number of loads to be copied when copying a load.
		</p>
	</div>
	<Switch
		disabled={!project_state.loaded}
		checked={settingsState.is_load_multi_copy}
		onCheckedChange={(v) => settingsState.setIsLoadMultiCopy(v)}
	/>
</div>
<Separator class="my-1 w-full" />
<div class="flex flex-col gap-3">
	<Label for="font-trigger">Font</Label>
	<Select.Root
		type="single"
		value={selectedFont}
		onValueChange={(value) => settingsState.setFont(value as Font)}
	>
		<Select.Trigger class="w-45" id="font-trigger" placeholder="Select a font">
			{selectedFont.charAt(0).toUpperCase().concat(selectedFont.slice(1))}
		</Select.Trigger>
		<Select.Content>
			{#each ['default', 'isocpeur', 'verdana'] as item, index (index)}
				<Select.Item class={item} disabled={selectedFont === item} value={item}
					>{item.charAt(0).toUpperCase().concat(item.slice(1))}</Select.Item
				>
			{/each}
		</Select.Content>
	</Select.Root>
</div>

{#snippet theme_tile(mode: 'light' | 'dark' | 'system', name: string, Icon: typeof SunIcon)}
	{@const active = settingsState.themeMode === mode}
	{@const label =
		mode === 'light' ? 'Light Theme' : mode === 'dark' ? 'Dark Theme' : 'System default theme'}
	<Label
		for={mode}
		class={cn(
			'group hover:border-border flex cursor-pointer flex-col gap-1.5 rounded-xl border border-transparent p-1.5 transition-all duration-150',
			active && 'border-primary/40 bg-primary/6 shadow-(--surface-shadow)'
		)}
	>
		<RadioGroup.Item
			value={mode}
			id={mode}
			class="sr-only"
			aria-label={label}
			onclick={() => settingsState.setThemeMode(mode)}
		/>
		{#if mode === 'light'}
			<span
				class={cn(
					'flex h-14 w-full flex-col gap-1 overflow-hidden rounded-lg border border-black/10 bg-[#fbfaf7] p-1.5'
				)}
				aria-hidden="true"
			>
				<span class="h-1.5 w-9 rounded-full bg-[#e3e1da]"></span>
				<span class="flex flex-1 gap-1">
					<span class="w-4 rounded-xs bg-[#eceae4]"></span>
					<span class="flex-1 rounded-xs border border-[#e7e5de] bg-white"></span>
				</span>
			</span>
		{:else if mode === 'dark'}
			<span
				class={cn(
					'flex h-14 w-full flex-col gap-1 overflow-hidden rounded-lg border border-white/10 bg-[#101613] p-1.5'
				)}
				aria-hidden="true"
			>
				<span class="h-1.5 w-9 rounded-full bg-[#232d27]"></span>
				<span class="flex flex-1 gap-1">
					<span class="w-4 rounded-xs bg-[#1b241f]"></span>
					<span class="flex-1 rounded-xs border border-white/5 bg-[#161e19]"></span>
				</span>
			</span>
		{:else}
			<span
				class={cn(
					'flex h-14 w-full overflow-hidden rounded-lg border border-black/10 dark:border-white/10'
				)}
				aria-hidden="true"
			>
				<span class="flex flex-1 flex-col gap-1 bg-[#fbfaf7] p-1.5">
					<span class="h-1.5 w-6 rounded-full bg-[#e3e1da]"></span>
					<span class="flex-1 rounded-xs border border-[#e7e5de] bg-white"></span>
				</span>
				<span class="flex flex-1 flex-col gap-1 bg-[#101613] p-1.5">
					<span class="h-1.5 w-6 rounded-full bg-[#232d27]"></span>
					<span class="flex-1 rounded-xs border border-white/5 bg-[#161e19]"></span>
				</span>
			</span>
		{/if}
		<span
			class={cn(
				'text-muted-foreground flex items-center justify-center gap-1.5 text-[11px] font-medium',
				active && 'text-foreground'
			)}
		>
			<Icon class="size-3.5" />
			{name}
		</span>
	</Label>
{/snippet}
