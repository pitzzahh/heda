<script lang="ts">
	import { Tooltip, TooltipContent, TooltipTrigger } from '$lib/components/ui/tooltip';
	import { Gear, Moon, Sun } from 'svelte-radix';
	import { buttonVariants } from '../ui/button';
	import * as Dialog from '../ui/dialog';
	import * as DropdownMenu from '../ui/dropdown-menu';
	import { Input } from '@/components/ui/input/index.js';
	import { Label } from '@/components/ui/label/index.js';
	import { Button } from '@/components/ui/button/index.js';
	import { resetMode, setMode } from 'mode-watcher';
</script>

<!-- TODO: CREATE THEME PROVIDER AND PERSISTENT STATE OF FONT AND THEME -->
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
