<script lang="ts" module>
	import type { ComponentProps } from 'svelte';
	import type OverrideSelectors from './override-selectors.svelte';

	type Props = ComponentProps<typeof OverrideSelectors>;
</script>

<script lang="ts">
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import Selectors from './override-selectors.svelte';

	let props: Props = $props();
</script>

<!-- The selectors hoist Override into the dialog footer, so they need a dialog. -->
<Dialog.Root open>
	<Dialog.Content>
		<Selectors {...props} />
	</Dialog.Content>
</Dialog.Root>
