<script lang="ts">
	import { Tooltip, TooltipContent, TooltipTrigger } from '$lib/components/ui/tooltip';
	import { Gear } from 'svelte-radix';
	import { buttonVariants } from '../ui/button';
	import * as Dialog from '../ui/dialog';
	import { Input } from '@/components/ui/input/index.js';
	import { Label } from '@/components/ui/label/index.js';
	import { Button } from '@/components/ui/button/index.js';
	import { mode } from 'mode-watcher';
	import { LocalStorage } from '@/hooks/storage.svelte';
	import setGlobalColorTheme from '@/theme-colors/theme-colors';

	const themeColors = [
		{ name: 'Autocad', value: 'autocad', bg: 'bg-[#C72323]' },
		{ name: 'Excel', value: 'excel', bg: 'bg-[#20B356]' }
	];

	const localStorage = new LocalStorage('theme_color');

	function handleChangeThemeColor(themeColor: string) {
		localStorage.current = { color: themeColor };
		setGlobalColorTheme($mode === 'light' ? 'light' : 'dark', themeColor);
	}
</script>

<!-- TODO: CREATE THEME PROVIDER AND PERSISTENT STATE OF FONT AND THEME -->
<Tooltip>
	<TooltipTrigger class={buttonVariants({ variant: 'outline', size: 'icon' })}>
		<Dialog.Root>
			<Dialog.Trigger>
				<Gear class="size-4" />
			</Dialog.Trigger>
			<Dialog.Content class="sm:max-w-[425px]">
				<Dialog.Header>
					<Dialog.Title>Settings</Dialog.Title>
					<Dialog.Description>Customize the application's theme color and font</Dialog.Description>
				</Dialog.Header>
				<div>
					{#each themeColors as themeColor, index (index)}
						<button onclick={() => handleChangeThemeColor(themeColor.value)}
							>{themeColor.name}</button
						>
					{/each}
				</div>
			</Dialog.Content>
		</Dialog.Root>
	</TooltipTrigger>
	<TooltipContent>Settings</TooltipContent>
</Tooltip>
