<script lang="ts" module>
	interface Props {
		open: boolean;
		mode: 'unlock' | 'create';
		error?: string | null;
		busy?: boolean;
		onSubmit: (password: string) => void;
	}
</script>

<script lang="ts">
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { PasswordInput } from '#lib/components/ui/password-input/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { cn } from '#lib/utils/index.js';
	import { LockKeyIcon, WarningCircleIcon } from '#lib/assets/icons/index.js';

	let { open = $bindable(false), mode, error = null, busy = false, onSubmit }: Props = $props();

	let password = $state('');
	let confirm = $state('');
	let local_error = $state<string | null>(null);

	function submit() {
		if (mode === 'create') {
			if (password.length < 8) {
				local_error = 'Password must be at least 8 characters.';
				return;
			}
			if (password !== confirm) {
				local_error = 'Passwords do not match.';
				return;
			}
		} else if (!password) {
			local_error = 'Enter the file password.';
			return;
		}
		local_error = null;
		onSubmit(password);
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		{#key open}
			<Dialog.Header>
				<div class="flex items-center gap-3">
					<div
						class="bg-primary/10 text-primary border-primary/15 flex size-11 shrink-0 items-center justify-center rounded-xl border"
					>
						<LockKeyIcon class="size-5" />
					</div>
					<div class="grid gap-0.5">
						<Dialog.Title>
							{mode === 'unlock' ? 'Enter the file password' : 'Set a file password'}
						</Dialog.Title>
						<Dialog.Description>
							{mode === 'unlock'
								? 'This file is password protected.'
								: 'Anyone with this password can open the file on any device.'}
						</Dialog.Description>
					</div>
				</div>
			</Dialog.Header>
			<form
				onsubmit={(e) => {
					e.preventDefault();
					submit();
				}}
			>
				<div class="grid gap-2">
					<div class="space-y-2">
						<Label class={cn((local_error ?? error) && 'text-destructive')}>Password</Label>
						<PasswordInput
							label="Password"
							bind:value={password}
							autocomplete={mode === 'create' ? 'new-password' : 'current-password'}
							placeholder={mode === 'unlock' ? 'File password' : 'Min. 8 characters'}
						/>
					</div>
					{#if mode === 'create'}
						<div class="space-y-2">
							<Label class={cn((local_error ?? error) && 'text-destructive')}
								>Confirm password</Label
							>
							<PasswordInput
								label="Confirm password"
								bind:value={confirm}
								autocomplete="new-password"
								placeholder="Repeat the password"
							/>
						</div>
					{/if}
					{#if (local_error ?? error) !== null}
						<div
							class="border-destructive/25 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2 text-xs font-medium"
							role="alert"
						>
							<WarningCircleIcon class="mt-0.5 size-4 shrink-0" />
							<span>{local_error ?? error}</span>
						</div>
					{/if}
				</div>
				<Button type="submit" disabled={busy} loading={busy} class="mt-5 h-11 w-full">
					{mode === 'unlock' ? 'Unlock file' : 'Set password and save'}
				</Button>
			</form>
			<Dialog.Close />
		{/key}
	</Dialog.Content>
</Dialog.Root>
