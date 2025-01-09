<script lang="ts">
	import { Save, FileUp } from '@/assets/icons';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Button, buttonVariants } from '@/components/ui/button';
	import { Settings } from '..';
	import { toast } from 'svelte-sonner';
	import type { Project, Node } from '@/db/schema';
	import { UndoRedoButtons } from './(components)';
	import { exportToExcel } from '@/helpers/export';
	import type { ButtonState } from '@/types/misc';
	import { generateKey, keyToString, writeEncryptedFile } from '@/helpers/security';
	import { getAllChildNodes } from '@/db/queries';

	let {
		project,
		root_node,
		app_pass_phrase
	}: { project?: Project; root_node: Node; app_pass_phrase: string | null } = $props();

	let component_state = $state({
		export_to_excel: 'idle' as ButtonState,
		can_save: true
	});

	async function handleSave() {
		try {
			if (!project) {
				return toast.warning('Failed to save, no project found', {
					description: 'This is a system error and should not be here, the error has been logged.'
				});
			}
			if (!app_pass_phrase) {
				component_state.can_save = false;
				return toast.warning('Failed to get the APP_PASS_PHRASE', {
					description: 'This is a system error and should not be here, the error has been logged.'
				});
			}
			const project_name = project?.project_name ?? 'Untitled';
			const sk = keyToString(generateKey(app_pass_phrase, project_name));

			await writeEncryptedFile(
				project_name,
				{ project, nodes: await getAllChildNodes(project.root_node_id, true) },
				sk
			);
		} catch (err) {
			toast.error(`Failed to load file: ${(err as any)?.message ?? 'something went wrong'}`, {
				description: 'An error occurred while loading the file.'
			});
		}
		return toast.success('Saved successfully');
	}
</script>

<div class="flex w-full items-center justify-between p-2">
	<div class="flex w-full items-center gap-2">
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger
					disabled={project === undefined || !component_state.can_save}
					class={buttonVariants({ variant: 'default', size: 'sm' })}
					onclick={handleSave}
				>
					<Save class="h-4 w-4" />
					Save
				</Tooltip.Trigger>
				<Tooltip.Content>Save changes (Ctrl+S)</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger>
					<Settings {project} />
				</Tooltip.Trigger>
				<Tooltip.Content>Settings</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
		<UndoRedoButtons />
	</div>
	<svelte:boundary>
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger
					disabled={component_state.export_to_excel === 'loading'}
					class={buttonVariants({ variant: 'outline', size: 'sm' })}
					onclick={() =>
						exportToExcel(
							root_node.id,
							root_node?.highest_unit_form,
							project?.project_name,
							() => (component_state.export_to_excel = 'idle'),
							() => (component_state.export_to_excel = 'loading')
						)}
				>
					<FileUp class="h-4 w-4" />
					Export to Excel
				</Tooltip.Trigger>
				<Tooltip.Content>Export project to excel</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
		{#snippet failed(error, reset)}
			<p class="text-sm text-muted-foreground">{error}</p>
			<Button onclick={reset}>oops! try again</Button>
		{/snippet}
	</svelte:boundary>
</div>
