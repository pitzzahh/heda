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
		app_update: Update | null;
		update_state: 'stale' | 'available' | 'no_updates' | 'processing' | 'error' | 'downloading';
	}
</script>

<script lang="ts">
	import { GearIcon, MagicWandIcon, MonitorIcon, RssIcon } from '#lib/assets/icons/index.js';
	import { PersistedState } from 'runed';
	import * as Breadcrumb from '#lib/components/ui/breadcrumb/index.js';
	import { buttonVariants } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';
	import { Update } from '@tauri-apps/plugin-updater';
	import { PreferencesSection, ProjectSection, UpdatesSection } from './(components)/index.js';

	const component_state = new PersistedState<SettingsComponentType>('settings_state', {
		active_setting: 'Project',
		app_update: null,
		update_state: 'stale'
	});

	// Open/close is session-only: a persisted dialog would reopen on every load.
	let settings_open = $state(false);
</script>

<Dialog.Root bind:open={settings_open}>
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
	<Dialog.Content class="w-full overflow-hidden p-0 md:max-h-125 md:max-w-175 lg:max-w-200">
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

				{#key component_state.current.active_setting}
					<div class="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0">
						{#if component_state.current.active_setting === 'Project'}
							<ProjectSection close_settings={() => (settings_open = false)} />
						{:else if component_state.current.active_setting === 'Preferences'}
							<PreferencesSection />
						{:else if component_state.current.active_setting === 'Updates'}
							<UpdatesSection
								bind:update_state={component_state.current.update_state}
								bind:app_update={component_state.current.app_update}
							/>
						{/if}
					</div>
				{/key}
			</main>
		</Sidebar.Provider>
		<Dialog.Close />
	</Dialog.Content>
</Dialog.Root>
