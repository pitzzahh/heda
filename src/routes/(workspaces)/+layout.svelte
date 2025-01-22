<script lang="ts">
	import { AppSidebar } from '@/components/custom/sidebar';
	import { Separator } from '@/components/ui/separator/index.js';
	import * as Sidebar from '@/components/ui/sidebar/index.js';
	import { buttonVariants, Button } from '@/components/ui/button/index.js';
	import * as Dialog from '@/components/ui/dialog/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { HighestUnitForm, PageProgress } from '@/components/custom';
	import { getState } from '@/state/index.svelte';
	import { DIALOG_STATE_CTX } from '@/state/constants.js';
	import type { DialogState } from '@/state/types.js';
	import type { Node } from '@/db/schema';
	import { toast } from 'svelte-sonner';
	import UndoRedoWrapper from '@/components/custom/undo-redo-wrapper.svelte';
	import { getCurrentProject, getRootNode } from '@/db/queries/index.js';
	import { getProjectState } from '@/hooks/project-state.svelte';

	let { data, children } = $props();

	const {
		is_new_file,
		is_load_file,
		loaded_project_id,
		project_title,
		generic_phase_panel_form,
		phase_main_load_form,
		app_pass_phrase,
		file_encryption_salt,
		can_create_project
	} = $derived(data);

	const dialogs_state = getState<DialogState>(DIALOG_STATE_CTX);
	const project_state = getProjectState();

	$effect(() => {
		if (is_load_file) {
			toast.loading('Loading project data', {
				description: 'Please wait while we load your project data.'
			});
		}
		dialogs_state.highestUnit = is_new_file;
	});
</script>

<PageProgress />
<UndoRedoWrapper>
	<Sidebar.Provider>
		{#if project_state.loaded}
			{#await getCurrentProject(loaded_project_id, project_title)}
				Waiting
			{:then project}
				<AppSidebar
					{project}
					root_node={data.root_node as Node}
					{generic_phase_panel_form}
					{phase_main_load_form}
					{can_create_project}
					{app_pass_phrase}
					{file_encryption_salt}
				/>
			{/await}
		{:else}
			<Sidebar.Inset>
				<header
					class="fixed z-10 flex h-16 w-full shrink-0 items-center gap-2 border-b bg-background px-4"
				>
					<Sidebar.Trigger class="-ml-1" />
					<Separator orientation="vertical" class="mr-2 h-4" />
					<p>
						{project_title ?? 'Untitled'}
					</p>
				</header>

				<svelte:boundary>
					<div class="mt-16 flex w-full items-center justify-center gap-4 p-4">
						{@render children?.()}
					</div>
					{#snippet failed(error, reset)}
						<p class="text-sm text-muted-foreground">{error}</p>
						<Button onclick={reset}>Something went horribly wrong. Click to FIX me</Button>
					{/snippet}
				</svelte:boundary>
			</Sidebar.Inset>
		{/if}
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
				{app_pass_phrase}
				{file_encryption_salt}
				closeDialog={() => (dialogs_state.highestUnit = false)}
			/>
		</Dialog.Content>
	</Dialog.Root>
</UndoRedoWrapper>

<AlertDialog.Root bind:open={dialogs_state.has_unsaved_changes}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Unsaved changes found!</AlertDialog.Title>
			<AlertDialog.Description>
				Would you like to save your current changes before performing any actions?
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel class={buttonVariants({ variant: 'ghost' })}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action class={buttonVariants({ variant: 'destructive' })}
				>Continue without saving changes</AlertDialog.Action
			>
			<AlertDialog.Action class={buttonVariants()}>Save and continue</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
