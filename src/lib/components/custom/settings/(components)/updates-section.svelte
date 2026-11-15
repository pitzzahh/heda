<script lang="ts" module>
	import type { SettingsComponentType } from '../settings.svelte';

	interface Props {
		update_state: SettingsComponentType['update_state'];
		app_update: SettingsComponentType['app_update'];
	}

	function toMegabytes(bytes: number): string {
		return (bytes / 1_048_576).toFixed(1);
	}
</script>

<script lang="ts">
	import { CircleNotchIcon, PackageIcon } from '#lib/assets/icons/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { checkForUpdates, installUpdate } from '#lib/helpers/update/index.js';
	import * as pj from '../../../../../../package.json';
	import { cn } from '#lib/utils/index.js';
	import { toast } from 'svelte-sonner';

	let { update_state = $bindable(), app_update = $bindable() }: Props = $props();

	let downloaded = $state(0);
	let total = $state<number | undefined>();
	const percent = $derived(
		total ? Math.min(100, Math.round((downloaded / total) * 100)) : undefined
	);
	const installing = $derived(total !== undefined && downloaded >= total);
	const progress_label = $derived(
		total
			? `${toMegabytes(downloaded)} of ${toMegabytes(total)} MB · ${percent}%`
			: `${toMegabytes(downloaded)} MB`
	);

	async function install(update: NonNullable<typeof app_update>) {
		downloaded = 0;
		total = undefined;
		update_state = 'downloading';
		try {
			await installUpdate(update, true, (bytes, size) => {
				downloaded = bytes;
				total = size;
			});
		} catch (error) {
			update_state = 'error';
			toast.warning(`Failed to install the update: ${error}`);
		}
	}

	async function check() {
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
	}
</script>

<div class="flex flex-col gap-4">
	{#if update_state === 'available'}
		<Alert.Root>
			<PackageIcon class="size-4" />
			<Alert.Description
				>New version available: v{app_update?.version ?? 'unknown'}</Alert.Description
			>
		</Alert.Root>
	{/if}
	<div>
		<p class="font-semibold">App Version</p>
		<span class="text-sm text-muted-foreground tabular-nums">v{pj.version}</span>
	</div>
	<svelte:boundary>
		{#if update_state === 'downloading'}
			<div class="flex flex-col gap-2 rounded-lg border p-3" role="status" aria-live="polite">
				<div class="flex items-center justify-between gap-4 text-sm">
					<span class="flex items-center gap-2 font-medium">
						<CircleNotchIcon class="size-4 animate-spin" />
						{installing ? 'Installing' : 'Downloading'} v{app_update?.version}
					</span>
					<span class="text-muted-foreground tabular-nums">{progress_label}</span>
				</div>
				<div
					class="h-1.5 w-full overflow-hidden rounded-full bg-muted"
					role="progressbar"
					aria-label="Update download"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={percent}
				>
					<div
						class={cn('h-full rounded-full bg-primary transition-[width] duration-300 ease-out', {
							'animate-pulse': percent === undefined
						})}
						style="width: {percent ?? 100}%"
					></div>
				</div>
			</div>
		{:else}
			<Button
				variant={update_state === 'available' ? 'default' : 'outline'}
				class="w-full"
				disabled={update_state === 'processing'}
				onclick={() => (update_state === 'available' && app_update ? install(app_update) : check())}
			>
				{#if update_state === 'processing'}
					<CircleNotchIcon class="size-4 animate-spin" />
					Checking
				{:else if update_state === 'available'}
					Download and install v{app_update?.version}
				{:else if update_state === 'no_updates'}
					Up to date. Check again
				{:else if update_state === 'error'}
					Something went wrong. Try again
				{:else}
					Check for updates
				{/if}
			</Button>
		{/if}
		{#snippet failed(error, reset)}
			<p class="text-sm text-muted-foreground">{error}</p>
			<Button onclick={reset} variant="outline" size="sm">Try again</Button>
		{/snippet}
	</svelte:boundary>
</div>
