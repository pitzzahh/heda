<script lang="ts">
	import '../app.css';
	import { ModeWatcher, mode } from 'mode-watcher';
	import { Toaster } from '@/components/ui/sonner/index.js';
	import { setState } from '@/state/index.svelte';
	import type { MiscState } from '@/state/types';
	import { MISC_STATE_CTX } from '@/state/constants';
	import SuperDebug from 'sveltekit-superforms';
	import { dev } from '$app/environment';
	import { LocalStorage } from '@/hooks/storage.svelte';
	import type { Settings } from '@/types/settings';
	import { setSettingsState } from '@/hooks/settings-state.svelte';

	let { children } = $props();

	let localStorage = new LocalStorage<Settings>('settings');
	setSettingsState(
		localStorage?.current?.color || 'excel',
		$mode === 'light' ? 'light' : 'dark',
		'default'
	);

	const miscState = setState<MiscState>(
		{
			form_data: {}
		},
		MISC_STATE_CTX
	);
</script>

<Toaster richColors={true} />
<ModeWatcher />
{@render children?.()}

{#if dev}
	<SuperDebug data={miscState.form_data} />
{/if}
