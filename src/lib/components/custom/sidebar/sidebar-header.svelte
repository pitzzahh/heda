<script lang="ts">
	import { Save, FilePlus } from 'lucide-svelte';
	import { Tooltip, TooltipContent, TooltipTrigger } from '$lib/components/ui/tooltip';
	import { Button } from '@/components/ui/button/index.js';
	import SettingsDialog from '../settings-dialog.svelte';

	function handleSave() {
		// Implement save functionality
		console.log('Saving...');
	}

	function handleNew() {
		// Implement new document functionality
		console.log('Creating new...');
	}
</script>

<div class="mt-2 flex justify-around">
	<div class="flex items-center justify-between gap-2">
		<div class="flex items-center gap-2">
			<Tooltip>
				<TooltipTrigger>
					<Button variant="default" size="sm" onclick={handleSave}>
						<Save class="mr-2 h-4 w-4" />
						Save
					</Button>
				</TooltipTrigger>
				<TooltipContent>Save changes (Ctrl+S)</TooltipContent>
			</Tooltip>

			<Tooltip>
				<TooltipTrigger>
					<Button variant="outline" size="sm" onclick={handleNew}>
						<FilePlus class="h-4 w-4" />
					</Button>
				</TooltipTrigger>
				<TooltipContent>New document</TooltipContent>
			</Tooltip>
		</div>

		<SettingsDialog />
	</div>
</div>
