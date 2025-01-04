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

	interface ComponentType {
		active_setting: NavName;
	}
</script>

<script lang="ts">
	import { slide } from 'svelte/transition';
	import { PersistedState } from 'runed';
	import * as Breadcrumb from '@/components/ui/breadcrumb/index.js';
	import { buttonVariants } from '@/components/ui/button/index.js';
	import * as Dialog from '@/components/ui/dialog/index.js';
	import * as Sidebar from '@/components/ui/sidebar/index.js';
	import { Cog } from '@/assets/icons';
	import Bell from 'lucide-svelte/icons/bell';
	import House from 'lucide-svelte/icons/house';
	import Menu from 'lucide-svelte/icons/menu';
	import Settings from 'lucide-svelte/icons/settings';

	const component_state = new PersistedState<ComponentType>('settings_state', {
		active_setting: 'Project'
	});
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
					{#each Array.from({ length: 10 }) as _, i (i)}
						<div transition:slide class="aspect-video max-w-3xl rounded-xl bg-muted/50">{i}</div>
					{/each}
				</div>
			</main>
		</Sidebar.Provider>
	</Dialog.Content>
</Dialog.Root>
