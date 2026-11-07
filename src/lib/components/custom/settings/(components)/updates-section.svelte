<script lang="ts" module>
	import type { SettingsComponentType } from '../settings.svelte';

	interface Props {
		update_state: SettingsComponentType['update_state'];
		app_update: SettingsComponentType['app_update'];
	}
</script>

<script lang="ts">
	import { CircleNotchIcon, PackageIcon } from '#lib/assets/icons/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { checkForUpdates, installUpdate } from '#lib/helpers/update/index.js';
	import * as pj from '../../../../../../package.json';
	import { cn } from '#lib/utils/index.js';
	import { toast } from 'svelte-sonner';

	let { update_state = $bindable(), app_update = $bindable() }: Props = $props();

	const tween = new Tween(0, { duration: 500, easing: cubicOut });
</script>

<div class="flex flex-col gap-2">
	{#if update_state === 'available'}
		<Alert.Root>
			<PackageIcon class="size-4" />
			<Alert.Description
				>New version available: v{app_update?.version ?? 'unknown'}</Alert.Description
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
			variant={update_state === 'available' ? 'default' : 'outline'}
			class={cn('relative w-full', {
				'cursor-not-allowed! opacity-50':
					update_state === 'processing' || update_state === 'no_updates',
				'p-0': update_state === 'downloading'
			})}
			onclick={async () => {
				if (update_state === 'available' && app_update) {
					tween.target = 0;
					update_state = 'downloading';
					return installUpdate(app_update, true, (progress) => {
						tween.target = Math.round(progress);
					});
				}
				if (update_state === 'processing' || update_state === 'no_updates') return;
				update_state = 'processing';
				try {
					app_update = await checkForUpdates();
					update_state = app_update ? 'available' : 'no_updates';
					if (!app_update) {
						toast.info('No updates available');
					} else {
						toast.success(`New version available: v${app_update.version}`);
					}
				} catch (error) {
					update_state = 'error';
					toast.warning(`Failed to check for updates: ${error}`);
				}
			}}
		>
			<CircleNotchIcon
				class={cn('mr-1 hidden h-4 w-4 animate-spin', {
					block: update_state === 'processing'
				})}
			/>

			{#if update_state === 'processing'}
				Checking
			{:else if update_state === 'available'}
				Download and install v{app_update?.version}
			{:else if update_state === 'no_updates'}
				No updates available
			{:else if update_state === 'downloading'}
				<div class="m-0 h-full w-full overflow-hidden rounded-md">
					<div
						class="from-primary to-primary/80 text-primary-foreground flex h-full items-center justify-center bg-linear-to-r text-[11px] font-semibold tabular-nums transition-all duration-500 ease-in-out"
						style="width: {Math.max(tween.target, 12)}%"
					>
						{tween.target}%
					</div>
				</div>
			{:else if update_state === 'error'}
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
