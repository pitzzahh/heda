<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { AppSidebar } from '@/components/custom/sidebar';
	import { Separator } from '@/components/ui/separator/index.js';
	import * as Sidebar from '@/components/ui/sidebar/index.js';
	import { Button } from '@/components/ui/button/index.js';
	import * as Dialog from '@/components/ui/dialog/index.js';
	import { HighestUnitForm, PageProgress } from '@/components/custom';
	import { Input } from '@/components/ui/input';
	import { PenLine, Save } from '@/assets/icons';
	import { getState } from '@/state/index.svelte';
	import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
	import { DIALOG_STATE_CTX } from '@/state/constants.js';
	import type { DialogState } from '@/state/types.js';
	import type { Project, Node } from '@/db/schema';
	import { updateProjectTitle } from '@/db/mutations/index.js';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import UndoRedoWrapper from '@/components/custom/undo-redo-wrapper.svelte';
	import PressCtrlWrapper from '@/components/custom/press-ctrl-wrapper.svelte';

	let { data, children } = $props();

	const { is_new_file, is_load_file, generic_phase_panel_form, phase_main_load_form } = data;

	let dialogs_state = getState<DialogState>(DIALOG_STATE_CTX);
	let is_editing = $state(false);

	let project_title = $state(data?.project?.project_name || 'Untitled');

	function toggleEdit() {
		is_editing = !is_editing;
		tick().then(() => {
			document.getElementById('project-title-input')?.focus();
		});
	}

	async function saveProjectTitle() {
		if (!data?.project || !project_title) return;
		await updateProjectTitle(data.project.id, project_title);
		await invalidateAll();
		toggleEdit();
	}

	onMount(() => {
		if (is_load_file && !data.root_node) {
			toast.warning('Failed to identify project data', {
				description: 'This is a system error and should not be here, the error has been logged.'
			});
			return;
		}
		dialogs_state.highestUnit = is_new_file;
	});
</script>

<PageProgress />
<UndoRedoWrapper>
	<Sidebar.Provider>
		<PressCtrlWrapper>
			<AppSidebar
				project={data.project}
				root_node={data.root_node as Node}
				{generic_phase_panel_form}
				{phase_main_load_form}
			/>
		</PressCtrlWrapper>

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
							{data.project?.project_name || 'Untitled'}
						</p>
					{/if}

					{#if data.project}
						<Tooltip>
							<TooltipTrigger>
								<Button
									size="icon"
									variant="outline"
									onclick={!is_editing ? toggleEdit : saveProjectTitle}
								>
									{#if is_editing}
										<Save class="h-4 w-4" />
									{:else}
										<PenLine class="h-4 w-4" />
									{/if}
								</Button>
							</TooltipTrigger>
							<TooltipContent>{is_editing ? 'Save' : 'Edit'}</TooltipContent>
						</Tooltip>
					{/if}
				</div>
			</header>

			<svelte:boundary>
				<div class="mt-16 flex w-full items-center justify-center gap-4 p-4">
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
</UndoRedoWrapper>
