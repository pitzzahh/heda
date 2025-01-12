<script lang="ts">
	import { tick } from 'svelte';
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
	import type { Node } from '@/db/schema';
	import { updateProjectTitle } from '@/db/mutations/index.js';
	import { invalidate } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import UndoRedoWrapper from '@/components/custom/undo-redo-wrapper.svelte';
	import PressAltWrapper from '@/components/custom/press-alt-wrapper.svelte';
	import { rename } from '@tauri-apps/plugin-fs';
	import { doesFileExists, generateUniqueFileName, BASE_DIR } from '@/helpers/file/index.js';

	let { data, children } = $props();

	const {
		is_new_file,
		is_load_file,
		generic_phase_panel_form,
		phase_main_load_form,
		project_title,
		app_pass_phrase,
		file_encryption_salt,
		can_create_project
	} = data;

	let dialogs_state = getState<DialogState>(DIALOG_STATE_CTX);

	let component_state = $state({
		is_editing: false,
		project_title
	});

	function toggleEdit() {
		component_state.is_editing = !component_state.is_editing;
		tick().then(() => {
			document.getElementById('project-title-input')?.focus();
		});
	}

	async function saveProjectTitle() {
		if (!data?.project || !component_state.project_title) return;
		try {
			const project_name = data.project_title;
			let new_project_name = component_state.project_title;
			const old_file = `${project_name}.heda`; // Untitled (2)
			const new_file = `${new_project_name}.heda`;
			if (await doesFileExists(new_file, { baseDir: BASE_DIR })) {
				new_project_name = await generateUniqueFileName(new_project_name, BASE_DIR);
				toast.info('Project title already exists, we will rename it for you.', {
					description: 'The project title is appended with a number to avoid conflicts.'
				});
				console.log({ old_file, _new_file: new_project_name });
				await rename(old_file, new_project_name, {
					oldPathBaseDir: BASE_DIR,
					newPathBaseDir: BASE_DIR
				});
				component_state.project_title = new_project_name.split('.')[0];
			}

			await updateProjectTitle(data.project.id, component_state.project_title);
			invalidate('app:workspace')
				.then(() => toggleEdit())
				.finally(() => toast.success('Project title updated successfully'));
		} catch (err) {
			console.error(err);
			return toast.error(
				`Failed to update project title: ${(err as any)?.message ?? 'something went wrong'}`,
				{
					description: 'This is a system error and should not be here, the error has been logged.'
				}
			);
		}
	}

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
		<PressAltWrapper>
			<AppSidebar
				project={data.project}
				root_node={data.root_node as Node}
				{generic_phase_panel_form}
				{phase_main_load_form}
				{can_create_project}
				{app_pass_phrase}
				{file_encryption_salt}
			/>
		</PressAltWrapper>

		<Sidebar.Inset>
			<header
				class="fixed z-10 flex h-16 w-full shrink-0 items-center gap-2 border-b bg-background px-4"
			>
				<Sidebar.Trigger class="-ml-1" />

				<Separator orientation="vertical" class="mr-2 h-4" />
				<div class="flex items-center gap-2">
					{#if component_state.is_editing}
						<Input
							bind:value={component_state.project_title}
							type="text"
							id="project-title-input"
						/>
					{:else}
						<p>
							{component_state.project_title || 'Untitled'}
						</p>
					{/if}

					{#if data.project}
						<Tooltip>
							<TooltipTrigger>
								<Button
									size="icon"
									variant="outline"
									onclick={!component_state.is_editing ? toggleEdit : saveProjectTitle}
								>
									{#if component_state.is_editing}
										<Save class="h-4 w-4" />
									{:else}
										<PenLine class="h-4 w-4" />
									{/if}
								</Button>
							</TooltipTrigger>
							<TooltipContent>{component_state.is_editing ? 'Save' : 'Edit'}</TooltipContent>
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
				{app_pass_phrase}
				{file_encryption_salt}
				closeDialog={() => (dialogs_state.highestUnit = false)}
			/>
		</Dialog.Content>
	</Dialog.Root>
</UndoRedoWrapper>
