<script lang="ts">
	import '../app.css';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '@/components/ui/sonner/index.js';

	let { children } = $props();
</script>

<Toaster />
<ModeWatcher />
{@render children?.()}
