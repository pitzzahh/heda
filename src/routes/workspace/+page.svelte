<script lang="ts">
	import { onMount } from 'svelte';
	import { AppSidebar } from '@/components/custom/sidebar';
	import * as Breadcrumb from '@/components/ui/breadcrumb/index.js';
	import { Separator } from '@/components/ui/separator/index.js';
	import * as Sidebar from '@/components/ui/sidebar/index.js';
	import { Button, buttonVariants } from '@/components/ui/button/index.js';
	import * as Dialog from '@/components/ui/dialog/index.js';
	import { toast } from 'svelte-sonner';
	import { HighestUnitForm } from '@/components/custom';

	let { data } = $props();
	const { is_new_file, is_load_file } = $derived(data);

	let highest_unit = $state(false);

	onMount(() => {
		toast.info(`Is new file: ${is_new_file}\nIs load file: ${is_load_file}`);
		highest_unit = is_new_file;
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
	<Dialog.Trigger class={buttonVariants({ variant: 'outline' })}>Highest unit form</Dialog.Trigger>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title class="text-center font-bold"
				>Choose the highest unit for this project.</Dialog.Title
			>
		</Dialog.Header>
		<HighestUnitForm highest_unit_form={data.highest_unit_form} />
	</Dialog.Content>
</Dialog.Root>
