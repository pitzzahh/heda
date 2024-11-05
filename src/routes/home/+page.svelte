<script lang="ts">
	import { AppSidebar } from '@/components/custom/sidebar';
	import * as Breadcrumb from '@/components/ui/breadcrumb/index.js';
	import { Separator } from '@/components/ui/separator/index.js';
	import * as Sidebar from '@/components/ui/sidebar/index.js';
	import { LocalStorage } from '@/hooks/storage.svelte';

	type Box = {
		color: string;
		dimensions: number[];
	};

	const box = new LocalStorage<Box>('box', {
		color: '#ff3e00',
		dimensions: [100, 100]
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
		<p>tip: open this page in multiple tabs</p>

		<label>
			<input type="color" bind:value={box.current.color} />
			color
		</label>

		<label>
			<input type="range" bind:value={box.current.dimensions[0]} min={100} max={500} />
			width
		</label>

		<label>
			<input type="range" bind:value={box.current.dimensions[1]} min={100} max={500} />
			height
		</label>

		<hr />

		<div
			class="box"
			style:background={box.current.color}
			style:width="{box.current.dimensions[0]}px"
			style:height="{box.current.dimensions[1]}px"
		></div>
	</Sidebar.Inset>
</Sidebar.Provider>

<style>
	label {
		display: flex;
		align-items: center;
		gap: 0.5em;
	}
</style>
