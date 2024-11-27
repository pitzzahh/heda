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
	import setGlobalColorTheme from '@/theme-colors/theme-colors';

	let { children } = $props();
	const localStorage = new LocalStorage<{ color: 'autocad' | 'excel' }>('theme_color');
	const themeColor = localStorage?.current?.color;

	const miscState = setState<MiscState>(
		{
			form_data: {}
		},
		MISC_STATE_CTX
	);

	$effect(() => {
		setGlobalColorTheme($mode === 'light' ? 'light' : 'dark', themeColor ? themeColor : 'excel');
	});
</script>

<Toaster richColors={true} />
<ModeWatcher />
{@render children?.()}

{#if dev}
	<SuperDebug data={miscState.form_data} />
{/if}
