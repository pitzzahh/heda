<script lang="ts">
	import { Save, FilePlus, Settings, MoreVertical } from 'lucide-svelte';
	import { Tooltip, TooltipContent, TooltipTrigger } from '$lib/components/ui/tooltip';
	import Sun from 'lucide-svelte/icons/sun';
	import Moon from 'lucide-svelte/icons/moon';
	import { Gear } from 'svelte-radix';
	import { resetMode, setMode } from 'mode-watcher';
	import * as DropdownMenu from '@/components/ui/dropdown-menu/index.js';
	import { Button, buttonVariants } from '@/components/ui/button/index.js';
	import * as Dialog from '@/components/ui/dialog/index.js';
	import { Input } from '@/components/ui/input/index.js';
	import { Label } from '@/components/ui/label/index.js';

	function handleSave() {
		// Implement save functionality
		console.log('Saving...');
	}

	function handleNew() {
		// Implement new document functionality
		console.log('Creating new...');
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
			<Tooltip>
				<TooltipTrigger class={buttonVariants({ variant: 'outline', size: 'icon' })}>
					<Dialog.Root>
						<Dialog.Trigger>
							<Gear class="size-4" />
						</Dialog.Trigger>
						<Dialog.Content class="sm:max-w-[425px]">
							<Dialog.Header>
								<Dialog.Title>Edit profile</Dialog.Title>
								<Dialog.Description>
									Make changes to your profile here. Click save when you're done.
								</Dialog.Description>
							</Dialog.Header>
							<div class="grid gap-4 py-4">
								<div class="grid grid-cols-4 items-center gap-4">
									<Label for="name" class="text-right">Name</Label>
									<Input id="name" value="Pedro Duarte" class="col-span-3" />
								</div>
								<div class="grid grid-cols-4 items-center gap-4">
									<Label for="username" class="text-right">Username</Label>
									<Input id="username" value="@peduarte" class="col-span-3" />
								</div>
							</div>
							<Dialog.Footer>
								<Button type="submit">Save changes</Button>
							</Dialog.Footer>
						</Dialog.Content>
					</Dialog.Root>
				</TooltipTrigger>
				<TooltipContent>Settings</TooltipContent>
			</Tooltip>

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
					<DropdownMenu.Item onclick={() => setMode('light')}>Light</DropdownMenu.Item>
					<DropdownMenu.Item onclick={() => setMode('dark')}>Dark</DropdownMenu.Item>
					<DropdownMenu.Item onclick={() => resetMode()}>System</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	</div>
</div>
