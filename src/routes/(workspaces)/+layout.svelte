<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { AppSidebar } from '@/components/custom/sidebar';
	import { Separator } from '@/components/ui/separator/index.js';
	import * as Sidebar from '@/components/ui/sidebar/index.js';
	import { Button } from '@/components/ui/button/index.js';
	import * as Dialog from '@/components/ui/dialog/index.js';
	import { toast } from 'svelte-sonner';
	import { HighestUnitForm } from '@/components/custom';
	import { Input } from '@/components/ui/input';
	import { PenLine, Save } from '@/assets/icons/lucide';
	import { Tooltip, TooltipContent, TooltipTrigger } from '$lib/components/ui/tooltip';
	import { getState } from '@/state/index.svelte';
	import { DIALOG_STATE_CTX } from '@/state/constants.js';
	import type { DialogState } from '@/state/types.js';
	import type { Node, Project } from '@/types/project/index.js';

	let { data, children } = $props();
	const { is_new_file, is_load_file, generic_phase_panel_form } = $derived(data);

	let dialogs_state = getState<DialogState>(DIALOG_STATE_CTX);
	let is_editing = $state(false);

	// TODO: ADD A DEFAULT VALUE OF THE PROJECT
	let project_title = $state('Untitled');

	onMount(() => {
		toast.info(`Is new file: ${is_new_file}\nIs load file: ${is_load_file}`);
		dialogs_state.highestUnit = is_new_file;
	});

	function toggleEdit() {
		is_editing = !is_editing;
		tick().then(() => {
			document.getElementById('project-title-input')?.focus();
		});
	}

	console.log(data.nodes);
</script>

<Sidebar.Provider>
	<AppSidebar
		tree={data.panels}
		project={data.project as unknown as Project | undefined}
		nodes={data.nodes as unknown as Node[]}
		{generic_phase_panel_form}
	/>
	<Sidebar.Inset>
		<header
			class="fixed z-10 flex h-16 w-full shrink-0 items-center gap-2 border-b bg-background px-4"
		>
			<Sidebar.Trigger class="-ml-1" />
			<Separator orientation="vertical" class="mr-2 h-4" />
			<div class="flex items-center gap-2">
				{#if is_editing}
					<Input bind:value={project_title} type="text" id="project-title-input" />
				{:else}
					<p>
						{project_title}
					</p>
				{/if}

				<Tooltip>
					<TooltipTrigger>
						<Button size="icon" variant="outline" onclick={toggleEdit}>
							{#if is_editing}
								<Save class="h-4 w-4" />
							{:else}
								<PenLine class="h-4 w-4" />
							{/if}
						</Button>
					</TooltipTrigger>
					<TooltipContent>{is_editing ? 'Save' : 'Edit'}</TooltipContent>
				</Tooltip>
			</div>
		</header>
		<svelte:boundary>
			<div class="mt-14 flex flex-1 flex-col justify-center gap-4 p-4">
				{@render children?.()}
			</div>
			{#snippet failed(error, reset)}
				<p class="text-sm text-muted-foreground">{error}</p>
				<Button onclick={reset}>oops! try again</Button>
			{/snippet}
		</svelte:boundary>
	</Sidebar.Inset>
</Sidebar.Provider>

<Dialog.Root bind:open={dialogs_state.highestUnit}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title class="text-center font-bold"
				>Choose the highest unit for this project.</Dialog.Title
			>
		</Dialog.Header>
		<HighestUnitForm
			highest_unit_form={data.highest_unit_form}
			closeDialog={() => (dialogs_state.highestUnit = false)}
		/>
	</Dialog.Content>
</Dialog.Root>
