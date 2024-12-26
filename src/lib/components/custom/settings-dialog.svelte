<script lang="ts">
	import * as Tooltip from '@/components/ui/tooltip';
	import * as Select from '@/components/ui/select';
	import { Cog, Loader } from '@/assets/icons';
	import { Button, buttonVariants } from '@/components/ui/button';
	import * as Dialog from '@/components/ui/dialog';
	import { Label } from '@/components/ui/label/index.js';
	import { mode } from 'mode-watcher';
	import type { Settings } from '@/types/settings';
	import { getSettingsState, type Font } from '@/hooks/settings-state.svelte';
	import { cn } from '@/utils';
	import { checkForUpdates } from '@/utils/update';
	import { Update } from '@tauri-apps/plugin-updater';

	const themeColors = [
		{ name: 'Autocad', value: 'autocad', bg: 'bg-[#C72323]' },
		{ name: 'Excel', value: 'excel', bg: 'bg-[#20B356]' }
	] as const;

	const settingsState = getSettingsState();
	const selectedFont = $derived(settingsState.font);

	let app_update: Update | null = $state(null);
	let update_state: 'stale' | 'available' | 'no_updates' | 'processing' = $state('stale');

	function handleChangeThemeColor(themeColor: Settings['color']) {
		if ($mode) {
			settingsState.setThemeColor(themeColor, $mode);
		}
	}
</script>

<Tooltip.Provider>
	<Tooltip.Root>
		<Tooltip.Trigger>
			<Dialog.Root>
				<Dialog.Trigger class={buttonVariants({ variant: 'outline', size: 'icon' })}>
					<Cog class="size-4" />
				</Dialog.Trigger>
				<Dialog.Content class="sm:max-w-[425px]">
					<Dialog.Header>
						<Dialog.Title>Settings</Dialog.Title>
						<Dialog.Description>Customize the application's theme color and font</Dialog.Description
						>
					</Dialog.Header>
					<div class="flex flex-col gap-4">
						<div class="flex flex-col gap-3">
							<Label for="colors">Theme Color</Label>
							<div id="colors" class="flex items-center gap-2">
								{#each themeColors as themeColor, index (index)}
									<button
										aria-label="color"
										class={cn(themeColor.bg, 'size-8 rounded-full', {
											'outline outline-2 outline-offset-1 outline-blue-500':
												themeColor.value === settingsState.themeColor
										})}
										onclick={() => handleChangeThemeColor(themeColor.value)}
									></button>
								{/each}
							</div>
						</div>

						<div class="flex flex-col gap-3">
							<Label for="font-trigger">Font</Label>
							<Select.Root
								type="single"
								value={selectedFont}
								onValueChange={(value) => settingsState.setFont(value as Font)}
							>
								<Select.Trigger class="w-[180px]" id="font-trigger" placeholder="Select a font">
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
						<svelte:boundary>
							<Button
								onclick={async () => {
									update_state = 'processing';
									app_update = await checkForUpdates();
									console.log('app_update', app_update);
									update_state = app_update ? 'available' : 'no_updates';
								}}
							>
								<Loader
									class={cn('mr-1 hidden h-4 w-4 animate-spin', {
										block: update_state === 'processing'
									})}
								/>
								<span>{update_state === 'processing' ? 'Checking' : 'Check for updates'}</span>
								<span>
									{#if update_state === 'available'}
										<span class="text-xs text-blue-500">v{app_update?.version}</span>
									{:else if update_state === 'no_updates'}
										<span class="text-xs text-green-500">No updates available</span>
									{/if}
								</span>
							</Button>
							{#snippet failed(error, reset)}
								<p class="text-sm text-muted-foreground">{error}</p>
								<Button onclick={reset}>oops! try again</Button>
							{/snippet}
						</svelte:boundary>
					</div>
				</Dialog.Content>
			</Dialog.Root>
		</Tooltip.Trigger>
		<Tooltip.Content>Settings</Tooltip.Content>
	</Tooltip.Root>
</Tooltip.Provider>
