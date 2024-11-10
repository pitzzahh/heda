<script lang="ts">
	import { onMount } from 'svelte';
	import { AppSidebar } from '@/components/custom/sidebar';
	import * as Breadcrumb from '@/components/ui/breadcrumb/index.js';
	import { Separator } from '@/components/ui/separator/index.js';
	import * as Sidebar from '@/components/ui/sidebar/index.js';
	import { LocalStorage } from '@/hooks/storage.svelte';
	import { Button, buttonVariants } from '@/components/ui/button/index.js';
	import * as Dialog from '@/components/ui/dialog/index.js';
	import { Input } from '@/components/ui/input/index.js';
	import { Label } from '@/components/ui/label/index.js';
	import { toast } from 'svelte-sonner';

	interface Props {
		is_new_file: boolean;
		is_load_file: boolean;
	}

	let { is_new_file, is_load_file }: Props = $props();

	let highest_unit = $state(false);

	type Box = {
		color: string;
		dimensions: number[];
	};

	onMount(() => {
		toast.info(`Is new file: ${is_new_file}\nIs load file: ${is_load_file}`);
		if (is_new_file) {
			highest_unit = true;
		}
	});
</script>

<Sidebar.Provider>
	<AppSidebar />
	<Sidebar.Inset>
		<header class="flex h-16 shrink-0 items-center gap-2 border-b px-4">
			<Sidebar.Trigger class="-ml-1" />
			<Separator orientation="vertical" class="mr-2 h-4" />
			<Breadcrumb.Root>
				<Breadcrumb.List>
					<Breadcrumb.Item class="hidden md:block">
						<Breadcrumb.Link href="#">lib</Breadcrumb.Link>
					</Breadcrumb.Item>
					<Breadcrumb.Separator class="hidden md:block" />
					<Breadcrumb.Item class="hidden md:block">
						<Breadcrumb.Link href="#">components</Breadcrumb.Link>
					</Breadcrumb.Item>
					<Breadcrumb.Separator class="hidden md:block" />
					<Breadcrumb.Item>
						<Breadcrumb.Page>button.svelte</Breadcrumb.Page>
					</Breadcrumb.Item>
				</Breadcrumb.List>
			</Breadcrumb.Root>
		</header>
	</Sidebar.Inset>
</Sidebar.Provider>

<Dialog.Root bind:open={highest_unit}>
	<Dialog.Trigger class={buttonVariants({ variant: 'outline' })}>Edit Profile</Dialog.Trigger>
	<Dialog.Content class="sm:max-w-[425px]">
		<Dialog.Header>
			<Dialog.Title class="text-center font-bold"
				>Choose the highest unit for this project.</Dialog.Title
			>
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
