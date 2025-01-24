<script module lang="ts">
	import { MonitorCog, Rss, WandSparkles, Sliders } from '@/assets/icons';

	const navData = [
		{ name: 'Project', icon: MonitorCog },
		{ name: 'Preferences', icon: WandSparkles },
		{ name: 'Updates', icon: Rss },
		{ name: 'Advanced', icon: Sliders }
	] as const;

	type NavName = (typeof navData)[number]['name'];

	type NavData = {
		nav: Readonly<{ name: NavName; icon: any }[]>;
	};

	const settings_links: NavData = {
		nav: navData
	};

	export interface SettingsComponentType {
		active_setting: NavName;
		settings_open: boolean;
		app_update: Update | null;
		update_state: 'stale' | 'available' | 'no_updates' | 'processing' | 'error' | 'downloading';
	}
</script>

<script lang="ts">
	import { slide } from 'svelte/transition';
	import { PersistedState } from 'runed';
	import * as Breadcrumb from '@/components/ui/breadcrumb/index.js';
	import { Button, buttonVariants } from '@/components/ui/button/index.js';
	import * as Dialog from '@/components/ui/dialog/index.js';
	import * as Sidebar from '@/components/ui/sidebar/index.js';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import * as Alert from '@/components/ui/alert/index.js';
	import * as RadioGroup from '@/components/ui/radio-group/index.js';
	import * as Select from '@/components/ui/select';
	import {
		Cog,
		Loader,
		PackageCheck,
		File,
		House,
		SquareCheck,
		CircleAlert,
		SunMoon,
		Moon,
		Sun
	} from '@/assets/icons';
	import { Label } from '@/components/ui/label/index.js';
	import { getSettingsState, type Font } from '@/hooks/settings-state.svelte';
	import { cn } from '@/utils';
	import { ViewChangelog } from '.';
	import { Separator } from '@/components/ui/separator/index.js';
	import { Switch } from '@/components/ui/switch/index.js';
	import type { Project } from '@/db/schema';
	import { updateProjectSettings } from '@/db/mutations';
	import { toast } from 'svelte-sonner';
	import { checkForUpdates, installUpdate } from '@/utils/update';
	import { Update } from '@tauri-apps/plugin-updater';
	import * as pj from '../../../../package.json';
	import { userPrefersMode } from 'mode-watcher';
	import type { Settings } from '@/types/settings';
	import { DIALOG_STATE_CTX } from '@/state/constants';
	import { getState } from '@/state/index.svelte';
	import type { DialogState } from '@/state/types';
	import { getUndoRedoState } from '@/hooks/undo-redo.svelte';
	import { getProjectState } from '@/hooks/project-state.svelte';
	import { resetData } from '@/db/mutations';

	let { project }: { project?: Project } = $props();

	const themeColors = [
		{ name: 'Autocad', value: 'autocad', bg: 'bg-[#C72323]' },
		{ name: 'Excel', value: 'excel', bg: 'bg-[#20B356]' }
	] as const;

	const settingsState = getSettingsState();
	const project_state = getProjectState();
	const undo_redo_state = getUndoRedoState();
	const selectedFont = $derived(settingsState.font);
	let dialogs_state = getState<DialogState>(DIALOG_STATE_CTX);
	const tween = new Tween(0, { duration: 500, easing: cubicOut });

	const component_state = new PersistedState<SettingsComponentType>('settings_state', {
		active_setting: 'Project',
		settings_open: false,
		app_update: null,
		update_state: 'stale'
	});

	async function savePreference(message: string) {
		if (!project_state.loaded) return;

		await updateProjectSettings(project_state.id, {
			is_adjustment_factor_dynamic: settingsState.is_adjustment_factor_dynamic
		})
			.then(() => undo_redo_state.setHasUnsavedActions())
			.finally(() => toast.success(message))
			.catch((e) => toast.warning(e));
	}

	function handleChangeThemeColor(themeColor: Settings['color']) {
		if (settingsState.themeMode) {
			settingsState.setThemeColor(
				themeColor,
				settingsState.themeMode === 'system'
					? $userPrefersMode === 'dark'
						? 'dark'
						: 'light'
					: settingsState.themeMode
			);
		}
	}

	async function handleNewProject() {
		await resetData();
		dialogs_state.highestUnit = true;
		component_state.current.settings_open = false;
	}
</script>

<Dialog.Root bind:open={component_state.current.settings_open}>
	<Dialog.Trigger class={buttonVariants({ size: 'icon', variant: 'outline' })}>
		<Cog class="size-4" />
	</Dialog.Trigger>
	<Dialog.Content class="overflow-hidden p-0 md:max-h-[500px] md:max-w-[700px] lg:max-w-[800px]">
		<Dialog.Title class="sr-only">Settings</Dialog.Title>
		<Dialog.Description class="sr-only">Customize your settings here.</Dialog.Description>
		<Sidebar.Provider
			class="items-start"
			style="--sidebar-width: 15rem; --sidebar-width-mobile: 15rem;"
		>
			<Sidebar.Root collapsible="none" class="hidden md:flex">
				<Sidebar.Content>
					<Sidebar.Group>
						<Sidebar.GroupContent>
							<Sidebar.Menu>
								{#each settings_links.nav as item (item.name)}
									<Sidebar.MenuItem>
										<Sidebar.MenuButton
											isActive={item.name === component_state.current.active_setting}
										>
											{#snippet child({ props })}
												<a
													href="##"
													{...props}
													onclick={() => (component_state.current.active_setting = item.name)}
												>
													<item.icon />
													<span>{item.name}</span>
												</a>
											{/snippet}
										</Sidebar.MenuButton>
									</Sidebar.MenuItem>
								{/each}
							</Sidebar.Menu>
						</Sidebar.GroupContent>
					</Sidebar.Group>
				</Sidebar.Content>
			</Sidebar.Root>
			<main class="flex h-[480px] flex-1 flex-col overflow-hidden">
				<header
					class="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12"
				>
					<div class="flex items-center gap-2 px-4">
						<Breadcrumb.Root>
							<Breadcrumb.List>
								<Breadcrumb.Item class="hidden md:block">
									<Breadcrumb.Link href="#">Settings</Breadcrumb.Link>
								</Breadcrumb.Item>
								<Breadcrumb.Separator class="hidden md:block" />
								<Breadcrumb.Item>
									<Breadcrumb.Page>
										{component_state.current.active_setting}
									</Breadcrumb.Page>
								</Breadcrumb.Item>
							</Breadcrumb.List>
						</Breadcrumb.Root>
					</div>
				</header>

				<div class="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0" transition:slide>
					{#if component_state.current.active_setting === 'Project'}
						{@render project_settings()}
					{:else if component_state.current.active_setting === 'Preferences'}
						{@render preferences_settings()}
					{:else if component_state.current.active_setting === 'Updates'}
						{@render updates_settings()}
					{/if}
				</div>
			</main>
		</Sidebar.Provider>
	</Dialog.Content>
</Dialog.Root>

{#snippet project_settings()}
	<div class="flex flex-col gap-2">
		<p class="font-semibold">Project</p>
		<div class="grid w-full grid-cols-2 gap-1.5">
			<Button onclick={() => resetData()} href="/" class="w-full" variant="outline">
				<House />
				Home
			</Button>
			<Button onclick={handleNewProject} class="w-full">
				<File />
				New Project
			</Button>
		</div>

		<Separator class="my-1 w-full" />
		<div class="flex flex-row items-center justify-between gap-3">
			<div class="space-y-0.5">
				<Label for="adjustment_factor">Adjustment Factor</Label>
				<p class="text-xs text-muted-foreground">
					{settingsState.is_adjustment_factor_dynamic
						? 'The adjustment factor for each load may vary between 100%, 80%, 70%, 50%, 45%, 40%, and 35%, depending on the total number of conductors.'
						: 'The adjustment factor for all loads will be set to 100%.'}
				</p>
			</div>
			<Switch
				disabled={!project_state.loaded}
				id="adjustment_factor"
				bind:checked={settingsState.is_adjustment_factor_dynamic}
				onCheckedChange={async () => await savePreference('Adjustment factor applied successfully')}
			/>
		</div>

		<Separator class="my-1 w-full" />
		<div class="flex flex-row items-center justify-between gap-3">
			<div class="space-y-0.5">
				<Label for="auto_save">Auto Save</Label>
				<p class="text-xs text-muted-foreground">Automatically save the changes in your project</p>
			</div>
			<Switch
				disabled={!project_state.loaded}
				id="auto_save"
				checked={settingsState.auto_save_enabled}
				onCheckedChange={(value) => {
					settingsState.setAutoSave(value);
					toast.success(`Auto save ${value ? 'enabled' : 'disabled'} successfully`);
				}}
			/>
		</div>
		<Separator class="my-1 w-full" />
		<div class="flex flex-col gap-2">
			<Alert.Root variant={settingsState.backup_project_file_if_exists ? 'valid' : 'warning'}>
				{#if settingsState.backup_project_file_if_exists}
					<SquareCheck class="size-4" />
				{:else}
					<CircleAlert class="size-4" />
				{/if}

				<Alert.Description>
					{#if settingsState.backup_project_file_if_exists}
						Old project file will be backed up when creating new project and replacing it upon
						project creation.
					{:else}
						Old project file will not be backed up when creating new project and replacing it upon
						project creation.
					{/if}
				</Alert.Description>
			</Alert.Root>
			<div class="flex flex-row items-center justify-between gap-3">
				<div class="space-y-0.5">
					<Label for="backup_project_file">Backup old project file</Label>
					<p class="text-xs text-muted-foreground">
						Automatically backup old project file when creating new project and performing replacing
						it upon project creation.
					</p>
				</div>
				<Switch
					id="backup_project_file"
					checked={settingsState.backup_project_file_if_exists}
					onCheckedChange={(value) => {
						settingsState.setBackupProjectFileIfExists(value);
						if (value) {
							toast.success(`Backup project file enabled successfully`, {
								description:
									'Old project file will be backed up when creating new project and replacing it upon project creation.'
							});
						} else {
							toast.warning(`Backup project file disabled successfully`, {
								description:
									'Old project file will not be backed up when creating new project and replacing it upon project creation.'
							});
						}
					}}
				/>
			</div>
		</div>
	</div>
{/snippet}

{#snippet preferences_settings()}
	<div class="flex items-center justify-between gap-2">
		<div class="flex w-full flex-col items-center justify-center gap-2">
			<Label for="colors">Theme</Label>
			<RadioGroup.Root value="" class="grid grid-cols-3">
				<Label
					for="light"
					class={cn(
						'flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground',
						{
							'border-primary': settingsState.themeMode === 'light'
						}
					)}
				>
					<RadioGroup.Item
						value="light"
						id="light"
						class="sr-only"
						aria-label="Light Theme"
						onclick={() => settingsState.setThemeMode('light')}
					/>
					<Sun class="h-4 w-4" />
				</Label>
				<Label
					for="dark"
					class={cn(
						'flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground',
						{
							'border-primary': settingsState.themeMode === 'dark'
						}
					)}
				>
					<RadioGroup.Item
						value="dark"
						id="dark"
						class="sr-only"
						aria-label="Dark Theme"
						onclick={() => settingsState.setThemeMode('dark')}
					/>
					<Moon class="h-4 w-4" />
				</Label>
				<Label
					for="system"
					class={cn(
						'flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground',
						{
							'border-primary': settingsState.themeMode === 'system'
						}
					)}
				>
					<RadioGroup.Item
						value="system"
						id="system"
						class="sr-only"
						aria-label="System default theme"
						onclick={() => settingsState.setThemeMode('system')}
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
	<Separator class="my-1 w-full" />
	<div class="flex flex-row items-center justify-between gap-3">
		<div class="space-y-0.5">
			<Label>Show loads in Unit Heirarchy</Label>
			<p class="text-xs text-muted-foreground">
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
			<p class="text-xs text-muted-foreground">
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
			<p class="text-xs text-muted-foreground">
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
{/snippet}

{#snippet updates_settings()}
	<div class="flex flex-col gap-2">
		{#if component_state.current.update_state === 'available'}
			<Alert.Root>
				<PackageCheck class="size-4" />
				<Alert.Description
					>New version available: v{component_state.current.app_update?.version ??
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
				variant={component_state.current.update_state === 'available' ? 'default' : 'outline'}
				class={cn('relative w-full', {
					'!cursor-not-allowed opacity-50':
						component_state.current.update_state === 'processing' ||
						component_state.current.update_state === 'no_updates'
				})}
				onclick={async () => {
					if (
						component_state.current.update_state === 'available' &&
						component_state.current.app_update
					) {
						tween.target = 0;
						component_state.current.update_state = 'downloading';
						return installUpdate(component_state.current.app_update, true, (progress) => {
							tween.target = Math.round(progress);
						});
					}
					if (
						component_state.current.update_state === 'processing' ||
						component_state.current.update_state === 'no_updates'
					)
						return;
					component_state.current.update_state = 'processing';
					try {
						component_state.current.app_update = await checkForUpdates();
						component_state.current.update_state = component_state.current.app_update
							? 'available'
							: 'no_updates';
						if (!component_state.current.app_update) {
							toast.info('No updates available');
						} else {
							toast.success(
								`New version available: v${component_state.current.app_update.version}`
							);
						}
					} catch (error) {
						component_state.current.update_state = 'error';
						toast.warning(`Failed to check for updates: ${error}`);
					}
				}}
			>
				<Loader
					class={cn('mr-1 hidden h-4 w-4 animate-spin', {
						block: component_state.current.update_state === 'processing'
					})}
				/>
				<span>
					{#if component_state.current.update_state === 'processing'}
						Checking
					{:else if component_state.current.update_state === 'available'}
						Download and install v{component_state.current.app_update?.version}
					{:else if component_state.current.update_state === 'no_updates'}
						No updates available
					{:else if component_state.current.update_state === 'downloading'}
						<div class="mt-5 h-4 w-full overflow-hidden rounded-full">
							<div
								class="h-4 rounded-full bg-green-400 transition-all duration-500 ease-in-out"
								style="width: {tween.target}% "
							>
								{tween.target}%
							</div>
						</div>
					{:else if component_state.current.update_state === 'error'}
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
{/snippet}

{#snippet advanced_settings()}{/snippet}
