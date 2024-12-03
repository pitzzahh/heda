<script lang="ts">
	import { Tooltip, TooltipContent, TooltipTrigger } from '$lib/components/ui/tooltip';
	import * as Select from '$lib/components/ui/select';
	import { Gear } from 'svelte-radix';
	import { buttonVariants } from '../ui/button';
	import * as Dialog from '../ui/dialog';
	import { Label } from '@/components/ui/label/index.js';
	import { mode } from 'mode-watcher';
	import type { Settings } from '@/types/settings';
	import { getSettingsState } from '@/hooks/settings-state.svelte';
	import { cn } from '@/utils';

	const themeColors = [
		{ name: 'Autocad', value: 'autocad', bg: 'bg-[#C72323]' },
		{ name: 'Excel', value: 'excel', bg: 'bg-[#20B356]' }
	] as const;

	let selectedFont = $state('Verdana');

	const settingsState = getSettingsState();

	function handleChangeThemeColor(themeColor: Settings['color']) {
		if ($mode) {
			settingsState.setThemeColor(themeColor, $mode);
		}
	}

	// TODO: IMPLEMENT CHANGING OF FONTS
	function handleFontChange(font: string) {
		if (!font || font === selectedFont) return;
		selectedFont = font;
	}
</script>

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
				<div class="flex flex-col gap-4">
					<div class="flex flex-col gap-3">
						<Label for="colors">Theme Color</Label>
						<div id="colors" class="flex items-center gap-2">
							{#each themeColors as themeColor, index (index)}
								<button
									aria-label="color"
									class={cn(themeColor.bg, 'size-8 rounded-full', {
										'outline outline-2 outline-offset-1 outline-blue-500':
											themeColor.value === settingsState.themeColor
									})}
									onclick={() => handleChangeThemeColor(themeColor.value)}
								></button>
							{/each}
						</div>
					</div>

					<div class="flex flex-col gap-3">
						<Label for="font-trigger">Font</Label>
						<Select.Root type="single" bind:value={selectedFont} onValueChange={handleFontChange}>
							<Select.Trigger class="w-[180px]" id="font-trigger" placeholder="Select a font">
								{selectedFont}
							</Select.Trigger>
							<Select.Content>
								{#each ['Iscopuer', 'Verdana'] as item, index (index)}
									<Select.Item disabled={selectedFont === item} value={item}>{item}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	</TooltipTrigger>
	<TooltipContent>Settings</TooltipContent>
</Tooltip>
