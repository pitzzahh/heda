<script lang="ts" module>
	import type { TitleBlock } from '#lib/types/title-block.js';

	interface Props {
		open: boolean;
	}

	type TextPath = [Exclude<keyof TitleBlock, 'sheet_size'>];

	/** PEC 2017 1.3.2.2 (A), (B) and (D); the rest of the title block is filled per sheet. */
	const FIELDS: { path: TextPath; label: string; placeholder: string }[] = [
		{ path: ['location'], label: 'Project location', placeholder: 'Lahug, Cebu City' },
		{ path: ['owner_name'], label: 'Owner', placeholder: 'Owner, manager or operator' },
		{ path: ['owner_address'], label: 'Owner address', placeholder: 'Address' },
		{
			path: ['engineer_name'],
			label: 'Professional Electrical Engineer',
			placeholder: 'Name, PEE'
		},
		{ path: ['prc_license_number'], label: 'PRC license no.', placeholder: '0000000' },
		{ path: ['prc_license_validity'], label: 'PRC license valid until', placeholder: '2028-12-31' },
		{ path: ['ptr_number'], label: 'PTR no.', placeholder: '0000000' },
		{ path: ['tin'], label: 'TIN', placeholder: '000-000-000-000' }
	];
</script>

<script lang="ts">
	import { createForm, Field, validate } from '@formisch/svelte';
	import { toast } from 'svelte-sonner';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import FieldErrors from '#lib/components/custom/field-errors.svelte';
	import { TITLE_BLOCK_SCHEMA } from '#lib/validators/title-block.js';
	import { A3_SHEET_MAX_VA, SHEET_SIZES } from '#lib/constants.js';
	import { getProject } from '#lib/db/index.js';
	import { updateTitleBlock } from '#lib/db/mutations/index.js';
	import { getComputedLoads, getRootNode } from '#lib/db/queries/index.js';
	import { getProjectState } from '#lib/hooks/project-state.svelte.js';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import { exportSheetSet, titleBlockChanged } from '#lib/helpers/export/sheet-set.js';
	import { UNTITLED_PROJECT_NAME } from '#lib/helpers/file/library.js';

	let { open = $bindable(false) }: Props = $props();

	const project_state = getProjectState();
	const undo_redo_state = getUndoRedoState();
	// PEC 2017 1.3.1.1(C): A3 only for a dwelling of at most 3680 VA (and 50 m², which heda
	// does not record, so the engineer confirms it). The engine refuses A3 past it too.
	const total_va = $derived(
		getComputedLoads(getRootNode()?.id ?? '').reduce((sum, row) => sum + (row.va || 0), 0)
	);
	const sizes = $derived(
		SHEET_SIZES.filter((size) => size.value !== 'A3' || total_va <= A3_SHEET_MAX_VA)
	);
	// The parent mounts this dialog per opening, so the stored block is read fresh each time.
	const form = createForm({ schema: TITLE_BLOCK_SCHEMA, initialInput: buildInitialInput() });
	let exporting = $state(false);

	async function handleSubmit() {
		if (exporting) return;
		const result = await validate(form);
		const project = getProject();
		if (!result.success || !project) return;
		exporting = true;
		try {
			if (titleBlockChanged(project.title_block, result.output)) {
				updateTitleBlock(project.id, result.output);
				undo_redo_state.setHasUnsavedActions();
			}
			await exportSheetSet(project_state.current_project_name || UNTITLED_PROJECT_NAME);
			open = false;
		} catch (error) {
			console.error('Sheet set export failed:', error);
			// The engine's refusals (e.g. A3 past 3680 VA) are plain text worth showing.
			toast.error('Could not build the sheet set', {
				description: typeof error === 'string' ? error : undefined
			});
		} finally {
			exporting = false;
		}
	}

	function buildInitialInput(): TitleBlock {
		const stored = getProject()?.title_block;
		// A stored size the load has outgrown (A3, 1.3.1.1(C)) is not offered, so start from the first.
		const sheet_size = sizes.some((size) => size.value === stored?.sheet_size)
			? stored?.sheet_size
			: SHEET_SIZES[0].value;
		return { ...stored, sheet_size };
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
		<Dialog.Header>
			<Dialog.Title>Sheet set (PDF)</Dialog.Title>
			<Dialog.Description>
				Riser diagram, schedules of loads, voltage drop and short circuit sheets, each with the PEC
				2017 1.3.2.2 title block. Saved with the project; sign and seal the printed sheets.
			</Dialog.Description>
		</Dialog.Header>
		<form
			id="sheet-set-form"
			class="grid gap-4 sm:grid-cols-2"
			onsubmit={(event) => {
				event.preventDefault();
				void handleSubmit();
			}}
		>
			{#each FIELDS as title_field (title_field.path[0])}
				<Field of={form} path={title_field.path}>
					{#snippet children(field)}
						<div class="grid content-start gap-2">
							<Label for={title_field.path[0]}>{title_field.label}</Label>
							<Input
								{...field.props}
								id={title_field.path[0]}
								value={field.input ?? ''}
								placeholder={title_field.placeholder}
								aria-invalid={!!field.errors}
							/>
							<FieldErrors errors={field.errors} />
						</div>
					{/snippet}
				</Field>
			{/each}
			<Field of={form} path={['sheet_size']}>
				{#snippet children(field)}
					<div class="grid content-start gap-2 sm:col-span-2">
						<Label>Sheet size (PEC 2017 1.3.1.1)</Label>
						<Select.Root
							type="single"
							value={field.input}
							onValueChange={(value) => field.onInput(value as TitleBlock['sheet_size'])}
						>
							<Select.Trigger class="w-full">
								{SHEET_SIZES.find((size) => size.value === field.input)?.label ?? 'Pick a size'}
							</Select.Trigger>
							<Select.Content>
								{#each sizes as size (size.value)}
									<Select.Item value={size.value}>{size.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						{#if total_va <= A3_SHEET_MAX_VA}
							<p class="text-[0.8rem] text-muted-foreground">
								A3 is only for a dwelling unit of at most 50 m² and 3680 VA (1.3.1.1(C)).
							</p>
						{/if}
						<FieldErrors errors={field.errors} />
					</div>
				{/snippet}
			</Field>
		</form>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
			<Button type="submit" form="sheet-set-form" loading={exporting}>Export PDF</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
