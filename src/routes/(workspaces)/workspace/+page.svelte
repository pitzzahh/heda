<script lang="ts">
	import { FileQuestionIcon } from '@/assets/icons/lucide';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { GenericPhaseMainLoadForm } from '@/components/custom/load';

	let { data } = $props();
</script>

<div class="grid size-full place-content-center place-items-center gap-2">
	<FileQuestionIcon class="size-24 text-muted-foreground" />
	<h2 class="text-xl font-semibold text-muted-foreground">No File Selected</h2>
</div>


