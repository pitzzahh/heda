<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import InputGroup from '#lib/components/ui/input-group/input-group.svelte';
	import InputGroupAddon from '#lib/components/ui/input-group/input-group-addon.svelte';
	import InputGroupInput from '#lib/components/ui/input-group/input-group-input.svelte';
	import type { InputGroupSize } from '#lib/components/ui/input-group/variants';
	import LetterMorph from '#lib/components/text/letter-morph/letter-morph.svelte';
	import { cn } from '#lib/utils';
	import {
		DEFAULT_STRENGTH_LABELS,
		measurePassword,
		type PasswordRule,
		type PasswordStrength,
		type PasswordStrengthLabels,
		strengthLabel
	} from './strength';
	import { passwordInput } from './variants';

	let {
		label,
		value = $bindable(''),
		onValueChange,
		revealed = $bindable(false),
		onRevealedChange,
		rules,
		shortLength = 8,
		strengthLabels,
		showLabel = 'Show password',
		hideLabel = 'Hide password',
		size = 'default',
		class: classProp,
		...rest
	}: Omit<HTMLInputAttributes, 'type' | 'value' | 'size' | 'class'> & {
		/** Accessible name of the field. */
		label: string;
		/** Bindable. */
		value?: string;
		onValueChange?: (value: string, strength: PasswordStrength) => void;
		/** Whether the password shows as text; bindable. */
		revealed?: boolean;
		onRevealedChange?: (revealed: boolean) => void;
		/** Rules to check; passing any shows the strength meter and checklist. `passwordRules()` gives the usual four. */
		rules?: PasswordRule[];
		/** Below this many characters the meter holds at its first step. */
		shortLength?: number;
		strengthLabels?: Partial<PasswordStrengthLabels>;
		/** Names of the reveal toggle. */
		showLabel?: string;
		hideLabel?: string;
		size?: InputGroupSize;
		class?: string;
	} = $props();

	const uid = $props.id();
	const maskId = `pw-${uid.replace(/[^a-zA-Z0-9_-]/g, '')}`;
	const rulesId = `${maskId}-rules`;
	const strength = $derived(measurePassword(value, rules ?? [], shortLength));
	const word = $derived(
		strengthLabel(value, strength, { ...DEFAULT_STRENGTH_LABELS, ...strengthLabels })
	);
	const s = $derived(passwordInput({ level: strength.level }));

	function set(next: string) {
		value = next;
		onValueChange?.(next, measurePassword(next, rules ?? [], shortLength));
	}
</script>

<div data-slot="password-input" class={cn(s.root(), classProp)}>
	<InputGroup {size}>
		<InputGroupInput
			{...rest}
			type={revealed ? 'text' : 'password'}
			aria-label={label}
			aria-describedby={rules?.length ? rulesId : rest['aria-describedby']}
			autocomplete={rest.autocomplete ?? (rules ? 'new-password' : 'current-password')}
			bind:value={() => value, set}
		/>
		<InputGroupAddon align="inline-end">
			<button
				type="button"
				aria-label={revealed ? hideLabel : showLabel}
				aria-pressed={revealed}
				data-revealed={revealed}
				class={cn('group/toggle', s.toggle())}
				onclick={() => {
					revealed = !revealed;
					onRevealedChange?.(revealed);
				}}
			>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.75"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
						<rect width="24" height="24" fill="white" stroke="none" />
						<path d="M2 2l20 20" stroke="black" stroke-width="5" pathLength="1" class={s.slash()} />
					</mask>
					<g mask="url(#{maskId})">
						<path
							d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"
						/>
						<circle cx="12" cy="12" r="3" />
					</g>
					<path d="M2 2l20 20" pathLength="1" class={s.slash()} />
				</svg>
			</button>
		</InputGroupAddon>
	</InputGroup>
	{#if rules?.length}
		<div class={s.meter()}>
			<div
				role="meter"
				aria-label="Password strength"
				aria-valuemin={0}
				aria-valuemax={4}
				aria-valuenow={strength.level}
				aria-valuetext={word}
				class={s.segments()}
			>
				{#each [1, 2, 3, 4] as step (step)}
					<span data-on={strength.level >= step} class={s.segment()}></span>
				{/each}
			</div>
			<LetterMorph text={word} class={s.word()} />
		</div>
		<ul id={rulesId} aria-label="Password requirements" class={s.rules()}>
			{#each rules as rule (rule.id)}
				{@const met = strength.met.includes(rule.id)}
				<li data-met={met} class={s.rule()}>
					<svg viewBox="0 0 14 14" fill="none" aria-hidden="true" data-on={met} class={s.tick()}>
						<path
							d="M3 7.4 5.6 10 11 4.2"
							pathLength="1"
							stroke="currentColor"
							stroke-width="1.6"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
					{rule.label}
					<span class="sr-only">{met ? ', met' : ', not met'}</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>
