<script lang="ts">
	import * as Tooltip from '@/components/ui/tooltip';
	import * as Select from '@/components/ui/select';
	import { Gear } from 'svelte-radix';
	import { buttonVariants } from '../ui/button';
	import * as Dialog from '../ui/dialog';
	import { Label } from '@/components/ui/label/index.js';
	import { mode } from 'mode-watcher';
	import type { Settings } from '@/types/settings';
	import { getSettingsState, type Font } from '@/hooks/settings-state.svelte';
	import { cn } from '@/utils';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import type { Project } from '@/db/schema';
	import Button from '../ui/button/button.svelte';
	import { updateProjectSettings } from '@/db/mutations';
	import { invalidate } from '$app/navigation';
	import { toast } from 'svelte-sonner';

	let { project }: { project?: Project } = $props();

	const themeColors = [
		{ name: 'Autocad', value: 'autocad', bg: 'bg-[#C72323]' },
		{ name: 'Excel', value: 'excel', bg: 'bg-[#20B356]' }
	] as const;

	const settingsState = getSettingsState();
	let selectedFont = $derived(settingsState.font);

	let is_adjustment_factor_constant = $state(
		project?.settings.is_adjustment_factor_constant || false
	);
	let has_changes = $derived(
		project?.settings.is_adjustment_factor_constant !== is_adjustment_factor_constant
	);

	function handleChangeThemeColor(themeColor: Settings['color']) {
		if ($mode) {
			settingsState.setThemeColor(themeColor, $mode);
		}
	}

	async function handleSaveChanges() {
		if (!project) return;

		await updateProjectSettings(project.id, { is_adjustment_factor_constant });
		await invalidate('app:workspace');
		toast.success('Adjustment Factor applied');	
	}
</script>

<Tooltip.Provider>
	<Tooltip.Root>
		<Tooltip.Trigger class={buttonVariants({ variant: 'outline', size: 'icon' })}>
			<Dialog.Root>
				<Dialog.Trigger>
					<Gear class="size-4" />
				</Dialog.Trigger>
				<Dialog.Content class="sm:max-w-[425px]">
					<Dialog.Header>
						<Dialog.Title>Settings</Dialog.Title>
						<Dialog.Description>Set your preferences in the application</Dialog.Description>
					</Dialog.Header>

					<div>
						<div class="flex flex-col gap-2">
							<p class="font-semibold">Project</p>
							<div class="flex flex-col gap-3">
								<Label for="adjustment_factor">Adjustment Factor</Label>
								<div class="flex w-full justify-between">
									<Switch
										disabled={!!!project}
										id="adjustment_factor"
										bind:checked={is_adjustment_factor_constant}
									/>

									{#if has_changes}
										<Button size="sm" onclick={handleSaveChanges}>Save Changes</Button>
									{/if}
								</div>

								<p class="text-xs text-muted-foreground">
									{is_adjustment_factor_constant
										? 'The adjustment factor for all loads will be set to 100%.'
										: 'The adjustment factor for each load may vary between 100%, 80%, 70%, 50%, 45%, 40%, and 35%, depending on the total number of conductors.'}
								</p>
							</div>
						</div>
						<Separator class="my-4 w-full" />
						<div class="flex flex-col gap-3">
							<p class="font-semibold">Preferences</p>
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
								<Select.Root
									type="single"
									value={selectedFont}
									onValueChange={(value) => settingsState.setFont(value as Font)}
								>
									<Select.Trigger class="w-[180px]" id="font-trigger" placeholder="Select a font">
										{selectedFont.charAt(0).toUpperCase().concat(selectedFont.slice(1))}
									</Select.Trigger>
									<Select.Content>
										{#each ['default', 'isocpeur', 'verdana'] as item, index (index)}
											<Select.Item class={item} disabled={selectedFont === item} value={item}
												>{item.charAt(0).toUpperCase().concat(item.slice(1))}</Select.Item
											>
										{/each}
									</Select.Content>
								</Select.Root>
							</div>
						</div>
					</div>
				</Dialog.Content>
			</Dialog.Root>
		</Tooltip.Trigger>
		<Tooltip.Content>Settings</Tooltip.Content>
	</Tooltip.Root>
</Tooltip.Provider>
