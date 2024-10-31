<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Save, FilePlus, Settings, MoreVertical } from 'lucide-svelte';
	import { Tooltip, TooltipContent, TooltipTrigger } from '$lib/components/ui/tooltip';

	function handleSave() {
		// Implement save functionality
		console.log('Saving...');
	}

	function handleNew() {
		// Implement new document functionality
		console.log('Creating new...');
	}
</script>

<header
	class="supports-[backdrop-filter]bg-background/60 w-full border-b border-border/40 bg-background/95 p-2 backdrop-blur"
>
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

		<div class="flex items-center gap-2">
			<Tooltip>
				<TooltipTrigger>
					<Button variant="ghost" size="sm">
						<Settings class="h-4 w-4" />
					</Button>
				</TooltipTrigger>
				<TooltipContent>Settings</TooltipContent>
			</Tooltip>

			<Button variant="ghost" size="sm">
				<MoreVertical class="h-4 w-4" />
			</Button>
		</div>
	</div>
</header>
