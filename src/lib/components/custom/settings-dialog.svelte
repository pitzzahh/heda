<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import * as Tooltip from '@/components/ui/tooltip';
	import * as Alert from '@/components/ui/alert/index.js';
	import * as RadioGroup from '@/components/ui/radio-group/index.js';
	import * as Select from '@/components/ui/select';
	import { Cog, Loader, PackageCheck, SunMoon, Moon, Sun } from '@/assets/icons';
	import { Button, buttonVariants } from '@/components/ui/button';
	import * as Dialog from '@/components/ui/dialog';
	import { Label } from '@/components/ui/label/index.js';
	import type { Settings } from '@/types/settings';
	import { getSettingsState, type Font } from '@/hooks/settings-state.svelte';
	import { cn } from '@/utils';
	import { ViewChangelog } from '.';
	import { Separator } from '@/components/ui/separator/index.js';
	import { Switch } from '@/components/ui/switch/index.js';
	import type { Project } from '@/db/schema';
	import { updateProjectSettings } from '@/db/mutations';
	import { invalidate } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { checkForUpdates, installUpdate } from '@/utils/update';
	import { Update } from '@tauri-apps/plugin-updater';
	import * as pj from '../../../../package.json';
	import { mode, systemPrefersMode } from 'mode-watcher';
	import { setModeAndColor } from '@/helpers/theme';

	let { project }: { project?: Project } = $props();

	const themeColors = [
		{ name: 'Autocad', value: 'autocad', bg: 'bg-[#C72323]' },
		{ name: 'Excel', value: 'excel', bg: 'bg-[#20B356]' }
	] as const;

	const settingsState = getSettingsState();
	const selectedFont = $derived(settingsState.font);

	const tween = new Tween(0, { duration: 500, easing: cubicOut });

	interface ComponentState {
		settings_open: boolean;
		app_update: Update | null;
		update_state: 'stale' | 'available' | 'no_updates' | 'processing' | 'error' | 'downloading';
		is_adjustment_factor_dynamic: boolean;
	}

	let component_state: ComponentState = $state({
		settings_open: false,
		app_update: null,
		update_state: 'stale',
		is_adjustment_factor_dynamic: project?.settings.is_adjustment_factor_dynamic || false
	});

	let is_adjustment_factor_dynamic_changed = $derived(
		project &&
			project.settings.is_adjustment_factor_dynamic !== component_state.is_adjustment_factor_dynamic
	);

	function handleChangeThemeColor(themeColor: Settings['color']) {
		if ($mode) {
			settingsState.setThemeColor(themeColor, $mode);
		}
	}

	async function savePreference(message: string) {
		if (!project) return;

		await updateProjectSettings(project.id, {
			is_adjustment_factor_dynamic: component_state.is_adjustment_factor_dynamic
		})
			.finally(() => {
				invalidate('app:workspace/load-schedule');
				toast.success(message);
			})
			.catch((e) => toast.warning(e));
	}

	$effect.pre(() => {
		if (component_state.settings_open) return;
		// reset all the fields if not settings_open
		if (!component_state.settings_open) {
			component_state.is_adjustment_factor_dynamic =
				project?.settings.is_adjustment_factor_dynamic || false;
			component_state.update_state = 'stale';
			component_state.app_update = null;
		}
	});
</script>

<Tooltip.Provider>
	<Tooltip.Root bind:open={component_state.settings_open}>
		<Tooltip.Trigger>
			<Dialog.Root>
				<Dialog.Trigger class={buttonVariants({ variant: 'outline', size: 'icon' })}>
					<Cog class="size-4" />
				</Dialog.Trigger>
				<Dialog.Content class="sm:max-w-[425px]">
					<Dialog.Header>
						<Dialog.Title class="text-center">Settings</Dialog.Title>
						<Dialog.Description class="text-center"
							>Set your preferences in the application</Dialog.Description
						>
					</Dialog.Header>
					<div class="flex flex-col gap-2">
						<p class="font-semibold">Project</p>
						<div class="flex flex-row items-center justify-between gap-3">
							<div class="space-y-0.5">
								<Label for="adjustment_factor">Adjustment Factor</Label>
								<p class="text-xs text-muted-foreground">
									{component_state.is_adjustment_factor_dynamic
										? 'The adjustment factor for each load may vary between 100%, 80%, 70%, 50%, 45%, 40%, and 35%, depending on the total number of conductors.'
										: 'The adjustment factor for all loads will be set to 100%.'}
								</p>
							</div>
							<Switch
								disabled={!!!project}
								id="adjustment_factor"
								bind:checked={component_state.is_adjustment_factor_dynamic}
								onCheckedChange={async (v) =>
									await savePreference('Adjustment factor applied successfully')}
							/>
						</div>
					</div>
					<Separator class="my-1 w-full" />
					<div class="flex flex-col gap-3">
						<p class="font-semibold">Preferences</p>
						<div class="flex items-center justify-between gap-2">
							<div class="flex w-full flex-col items-center justify-center gap-2">
								<Label for="colors">Theme</Label>
								<RadioGroup.Root
									value={$mode}
									class="grid grid-cols-3"
									onValueChange={(v) =>
										setModeAndColor(
											settingsState,
											v === 'system' || v === undefined
												? $systemPrefersMode === 'light'
													? 'light'
													: 'dark'
												: v === 'light'
													? 'light'
													: 'dark'
										)}
								>
									<Label
										for="light"
										class="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary"
									>
										<RadioGroup.Item
											value="light"
											id="light"
											class="sr-only"
											aria-label="Light Theme"
										/>
										<Sun class="h-4 w-4" />
									</Label>
									<Label
										for="dark"
										class="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary"
									>
										<RadioGroup.Item
											value="dark"
											id="dark"
											class="sr-only"
											aria-label="Dark Theme"
										/>
										<Moon class="h-4 w-4" />
									</Label>
									<Label
										for="system"
										class="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary"
									>
										<RadioGroup.Item
											value="system"
											id="system"
											class="sr-only"
											aria-label="System default theme"
										/>
										<SunMoon class="h-4 w-4" />
									</Label>
								</RadioGroup.Root>
							</div>
							<div class="flex w-full flex-col items-center justify-center gap-2">
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
						</div>

						<div class="flex flex-row items-center justify-between gap-3">
							<div class="space-y-0.5">
								<Label>Show loads in Unit Heirarchy</Label>
								<p class="text-xs text-muted-foreground">
									Show or hide loads in the unit hierarchy, minimizing the hierarchy view.
								</p>
							</div>
							<Switch
								checked={settingsState.show_loads_on_unit_hierarchy}
								onCheckedChange={(v) => settingsState.setShowLoadsOnUnitHeirarchy(v)}
							/>
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
					</div>
					<Separator class="my-1 w-full" />
					<div class="flex flex-col gap-2">
						{#if component_state.update_state === 'available'}
							<Alert.Root>
								<PackageCheck class="size-4" />
								<Alert.Description
									>New version available: v{component_state.app_update?.version ??
										'unknown'}</Alert.Description
								>
							</Alert.Root>
						{/if}
						<div>
							<div class="flex items-center justify-between">
								<p class="font-semibold">App Version</p>
								<ViewChangelog />
							</div>
							<span class="text-sm tabular-nums">v{pj.version}</span>
						</div>
						<svelte:boundary>
							<Button
								variant={component_state.update_state === 'available' ? 'default' : 'outline'}
								class={cn('button-background', {
									'!cursor-not-allowed opacity-50':
										component_state.update_state === 'processing' ||
										component_state.update_state === 'no_updates'
								})}
								onclick={async () => {
									if (component_state.update_state === 'available' && component_state.app_update) {
										tween.target = 0;
										component_state.update_state = 'downloading';
										return installUpdate(component_state.app_update, true, (progress) => {
											tween.target = Math.round(progress);
										});
									}
									if (
										component_state.update_state === 'processing' ||
										component_state.update_state === 'no_updates'
									)
										return;
									component_state.update_state = 'processing';
									try {
										component_state.app_update = await checkForUpdates();
										console.log('component_state.app_update', component_state.app_update);
										component_state.update_state = component_state.app_update
											? 'available'
											: 'no_updates';
										if (!component_state.app_update) {
											toast.info('No updates available');
										} else {
											toast.success(
												`New version available: v${component_state.app_update.version}`
											);
										}
									} catch (error) {
										component_state.update_state = 'error';
										toast.warning(`Failed to check for updates: ${error}`);
									}
								}}
							>
								<Loader
									class={cn('mr-1 hidden h-4 w-4 animate-spin', {
										block: component_state.update_state === 'processing'
									})}
								/>
								<span>
									{#if component_state.update_state === 'processing'}
										Checking
									{:else if component_state.update_state === 'available'}
										Download and install v{component_state.app_update?.version}
									{:else if component_state.update_state === 'no_updates'}
										No updates available
									{:else if component_state.update_state === 'downloading'}
										{tween.target}%
									{:else if component_state.update_state === 'error'}
										Something went wrong while checking for updates
									{:else}
										Check for updates
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

<style>
	.button-background {
		position: relative;
		overflow: hidden;
	}

	.button-background::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: var(--progress, 0%);
		height: 100%;
		background-color: var(--primary); /* Highlight color */
		pointer-events: none;
		transition: width 0.1s ease; /* Smooth transition */
	}
</style>
