<script module lang="ts">
	const navData = [
		{ name: 'Project', icon: Bell },
		{ name: 'Preferences', icon: Menu },
		{ name: 'Updates', icon: House },
		{ name: 'Advanced', icon: Settings }
	] as const;

	type NavName = (typeof navData)[number]['name'];

	type Data = {
		nav: Readonly<{ name: NavName; icon: any }[]>;
	};

	const data: Data = {
		nav: navData
	};

	export interface SettingsComponentType {
		active_setting: NavName;
		settings_open: boolean;
		app_update: Update | null;
		update_state: 'stale' | 'available' | 'no_updates' | 'processing' | 'error' | 'downloading';
		is_adjustment_factor_dynamic: boolean;
		show_loads_on_unit_hierarchy: boolean;
	}
</script>

<script lang="ts">
	import { slide } from 'svelte/transition';
	import { PersistedState } from 'runed';
	import * as Breadcrumb from '@/components/ui/breadcrumb/index.js';
	import { buttonVariants } from '@/components/ui/button/index.js';
	import * as Dialog from '@/components/ui/dialog/index.js';
	import * as Sidebar from '@/components/ui/sidebar/index.js';
	import Bell from 'lucide-svelte/icons/bell';
	import House from 'lucide-svelte/icons/house';
	import Menu from 'lucide-svelte/icons/menu';
	import Settings from 'lucide-svelte/icons/settings';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import * as Tooltip from '@/components/ui/tooltip';
	import * as Alert from '@/components/ui/alert/index.js';
	import * as RadioGroup from '@/components/ui/radio-group/index.js';
	import * as Select from '@/components/ui/select';
	import { Cog, Loader, PackageCheck, SunMoon, Moon, Sun } from '@/assets/icons';
	import { Label } from '@/components/ui/label/index.js';
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

	const component_state = new PersistedState<SettingsComponentType>('settings_state', {
		active_setting: 'Project',
		settings_open: false,
		app_update: null,
		update_state: 'stale',
		is_adjustment_factor_dynamic: project?.settings.is_adjustment_factor_dynamic || false,
		show_loads_on_unit_hierarchy: settingsState.show_loads_on_unit_hierarchy
	});

	async function savePreference(message: string) {
		if (!project) return;

		await updateProjectSettings(project.id, {
			is_adjustment_factor_dynamic: component_state.current.is_adjustment_factor_dynamic
		})
			.finally(() => toast.success(message))
			.catch((e) => toast.warning(e));
		settingsState.setShowLoadsOnUnitHeirarchy(component_state.current.show_loads_on_unit_hierarchy);
	}
</script>

<Dialog.Root>
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
								{#each data.nav as item (item.name)}
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

				<div class="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0">
					{#if component_state.current.active_setting === 'Project'}
						{@render project_settings()}
					{/if}
				</div>
			</main>
		</Sidebar.Provider>
	</Dialog.Content>
</Dialog.Root>

{#snippet project_settings()}
	<div class="flex flex-col gap-2">
		<p class="font-semibold">Project</p>
		<div class="flex flex-row items-center justify-between gap-3">
			<div class="space-y-0.5">
				<Label for="adjustment_factor">Adjustment Factor</Label>
				<p class="text-xs text-muted-foreground">
					{component_state.current.is_adjustment_factor_dynamic
						? 'The adjustment factor for each load may vary between 100%, 80%, 70%, 50%, 45%, 40%, and 35%, depending on the total number of conductors.'
						: 'The adjustment factor for all loads will be set to 100%.'}
				</p>
			</div>
			<Switch
				disabled={project === undefined}
				id="adjustment_factor"
				bind:checked={component_state.current.is_adjustment_factor_dynamic}
				onCheckedChange={async (v) =>
					await savePreference('Adjustment factor applied successfully')}
			/>
		</div>
	</div>
{/snippet}
