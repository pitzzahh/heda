<script lang="ts">
	import { Save, FilePlus } from 'lucide-svelte';
	import { Tooltip, TooltipContent, TooltipTrigger } from '$lib/components/ui/tooltip';
	import { Button, buttonVariants } from '@/components/ui/button/index.js';
	import SettingsDialog from '../settings-dialog.svelte';
	import { Moon, Sun } from 'svelte-radix';
	import { setMode, systemPrefersMode } from 'mode-watcher';
	import * as DropdownMenu from '@/components/ui/dropdown-menu';
	import { getSettingsState } from '@/hooks/settings-state.svelte';

	const settingsState = getSettingsState();

	function handleSave() {
		// Implement save functionality
		$inspect('Saving...');
	}

	function handleNew() {
		// Implement new document functionality
		$inspect('Creating new...');
	}

	function setModeAndColor(mode: 'dark' | 'light') {
		settingsState.setThemeColor(settingsState.themeColor, mode);
		setMode(mode);
	}
</script>

<div class="mt-2 flex justify-around">
	<div class="flex items-center justify-between gap-2">
		<div class="flex items-center gap-2">
			<Tooltip>
				<TooltipTrigger>
					<Button variant="default" size="sm" onclick={handleSave}>
						<Save class="mr-2 h-4 w-4" />
						Save
					</Button>
				</TooltipTrigger>
				<TooltipContent>Save changes (Ctrl+S)</TooltipContent>
			</Tooltip>

			<Tooltip>
				<TooltipTrigger>
					<Button variant="outline" size="sm" onclick={handleNew}>
						<FilePlus class="h-4 w-4" />
					</Button>
				</TooltipTrigger>
				<TooltipContent>New document</TooltipContent>
			</Tooltip>
		</div>

		<div class="flex items-center gap-2">
			<SettingsDialog />
			<DropdownMenu.Root>
				<DropdownMenu.Trigger class={buttonVariants({ variant: 'outline', size: 'icon' })}>
					<Sun
						class="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
					/>
					<Moon
						class="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
					/>
					<span class="sr-only">Toggle theme</span>
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end">
					<DropdownMenu.Item onclick={() => setModeAndColor('light')}>Light</DropdownMenu.Item>
					<DropdownMenu.Item onclick={() => setModeAndColor('dark')}>Dark</DropdownMenu.Item>
					<DropdownMenu.Item
						onclick={() => setModeAndColor($systemPrefersMode === 'light' ? 'light' : 'dark')}
					>
						System
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	</div>
</div>
