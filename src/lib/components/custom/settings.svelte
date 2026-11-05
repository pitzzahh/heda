<script module lang="ts">
	const navData = [
		{ name: 'Project', icon: MonitorIcon },
		{ name: 'Preferences', icon: MagicWandIcon },
		{ name: 'Updates', icon: RssIcon }
	] as const;

	type NavName = (typeof navData)[number]['name'];

	type NavIcon = typeof MonitorIcon | typeof RssIcon | typeof MagicWandIcon;

	type NavData = {
		nav: Readonly<{ name: NavName; icon: NavIcon }[]>;
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
	import {
		CheckSquareIcon,
		CircleHalfIcon,
		CircleNotchIcon,
		FileIcon,
		GearIcon,
		HouseIcon,
		MagicWandIcon,
		MonitorIcon,
		MoonIcon,
		PackageIcon,
		RssIcon,
		SunIcon,
		WarningCircleIcon
	} from '#lib/assets/icons';
	import { slide } from 'svelte/transition';
	import { PersistedState } from 'runed';
	import * as Breadcrumb from '#lib/components/ui/breadcrumb/index.js';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import * as RadioGroup from '#lib/components/ui/radio-group/index.js';
	import * as Select from '#lib/components/ui/select';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { getSettingsState } from '#lib/hooks/settings-state.svelte';
	import type { Font } from '#lib/types/settings';
	import { cn } from '#lib/utils';
	import { Separator } from '#lib/components/ui/separator/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import { updateProjectSettings } from '#lib/db/mutations';
	import { toast } from 'svelte-sonner';
	import { checkForUpdates, installUpdate } from '#lib/utils/update';
	import { Update } from '@tauri-apps/plugin-updater';
	import * as pj from '../../../../package.json';
	import { userPrefersMode } from 'mode-watcher';
	import type { Settings } from '#lib/types/settings';
	import { DIALOG_STATE_CTX } from '#lib/state/constants';
	import { getState } from '#lib/state/index.svelte';
	import type { DialogState } from '#lib/state/types';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte';
	import { getProjectState } from '#lib/hooks/project-state.svelte';
	import { resetData } from '#lib/db/mutations';

	const themeColors = [
		{ name: 'Autocad', value: 'autocad', bg: 'bg-[#BF2722]' },
		{ name: 'Excel', value: 'excel', bg: 'bg-[#137C4D]' }
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
					? userPrefersMode.current === 'dark'
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
	<Tooltip.Provider>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Dialog.Trigger {...props} class={buttonVariants({ size: 'icon-sm', variant: 'ghost' })}>
						<GearIcon class="size-4" />
					</Dialog.Trigger>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content>Settings</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
	<Dialog.Content
		class="w-full overflow-hidden p-0 md:max-h-125 md:max-w-175 lg:max-w-200"
	>
		<Dialog.Title class="sr-only">Settings</Dialog.Title>
		<Dialog.Description class="sr-only">Customize your settings here.</Dialog.Description>
		<Sidebar.Provider
			class="min-h-0"
			style="--sidebar-width: 15rem; --sidebar-width-mobile: 15rem;"
		>
			<Sidebar.Root collapsible="none" class="hidden h-auto md:flex">
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
			<main class="flex h-[min(480px,80vh)] flex-1 flex-col overflow-hidden">
				<header
					class="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12"
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
		<Dialog.Close />
	</Dialog.Content>
</Dialog.Root>

{#snippet project_settings()}
	<div class="flex flex-col gap-2">
		<p class="text-sm font-semibold tracking-tight">Project</p>
		<div class="grid w-full grid-cols-2 gap-1.5">
			<Button onclick={() => resetData()} href="/" class="w-full" variant="outline">
				<HouseIcon />
				Home
			</Button>
			<Button onclick={handleNewProject} class="w-full">
				<FileIcon />
				New Project
			</Button>
		</div>

		<Separator class="my-1 w-full" />
		<div class="flex flex-row items-center justify-between gap-3">
			<div class="space-y-0.5">
				<Label for="adjustment_factor">Adjustment Factor</Label>
				<p class="text-muted-foreground text-xs">
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
				<p class="text-muted-foreground text-xs">Automatically save the changes in your project</p>
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
			<Alert.Root variant={settingsState.backup_project_file_if_exists ? 'success' : 'warning'}>
				{#if settingsState.backup_project_file_if_exists}
					<CheckSquareIcon class="size-4" />
				{:else}
					<WarningCircleIcon class="size-4" />
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
					<p class="text-muted-foreground text-xs">
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
{/snippet}

{#snippet updates_settings()}
	<div class="flex flex-col gap-2">
		{#if component_state.current.update_state === 'available'}
			<Alert.Root>
				<PackageIcon class="size-4" />
				<Alert.Description
					>New version available: v{component_state.current.app_update?.version ??
						'unknown'}</Alert.Description
				>
			</Alert.Root>
		{/if}
		<div>
			<div class="flex items-center justify-between">
				<p class="font-semibold">App Version</p>
			</div>
			<span class="text-sm tabular-nums">v{pj.version}</span>
		</div>
		<svelte:boundary>
			<Button
				variant={component_state.current.update_state === 'available' ? 'default' : 'outline'}
				class={cn('relative w-full', {
					'cursor-not-allowed! opacity-50':
						component_state.current.update_state === 'processing' ||
						component_state.current.update_state === 'no_updates',
					'p-0': component_state.current.update_state === 'downloading'
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
				<CircleNotchIcon
					class={cn('mr-1 hidden h-4 w-4 animate-spin', {
						block: component_state.current.update_state === 'processing'
					})}
				/>

				{#if component_state.current.update_state === 'processing'}
					Checking
				{:else if component_state.current.update_state === 'available'}
					Download and install v{component_state.current.app_update?.version}
				{:else if component_state.current.update_state === 'no_updates'}
					No updates available
				{:else if component_state.current.update_state === 'downloading'}
					<div class="m-0 h-full w-full overflow-hidden rounded-md">
						<div
							class="from-primary to-primary/80 text-primary-foreground flex h-full items-center justify-center bg-linear-to-r text-[11px] font-semibold tabular-nums transition-all duration-500 ease-in-out"
							style="width: {Math.max(tween.target, 12)}%"
						>
							{tween.target}%
						</div>
					</div>
				{:else if component_state.current.update_state === 'error'}
					Something went wrong while checking for updates
				{:else}
					Check for updates
				{/if}
			</Button>
			{#snippet failed(error, reset)}
				<p class="text-muted-foreground text-sm">{error}</p>
				<Button onclick={reset} variant="outline" size="sm">Try again</Button>
			{/snippet}
		</svelte:boundary>
	</div>
{/snippet}

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
					<span class="flex flex-1 rounded-xs border border-[#e7e5de] bg-white"></span>
				</span>
				<span class="flex flex-1 flex-col gap-1 bg-[#101613] p-1.5">
					<span class="h-1.5 w-6 rounded-full bg-[#232d27]"></span>
					<span class="flex flex-1 rounded-xs border border-white/5 bg-[#161e19]"></span>
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
