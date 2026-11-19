import { describe, expect, it } from 'vitest';
import { hypot, numberFromStr, roundJs, toFixedJs } from './pkg/heda_core.js';

/** Deterministic PRNG (mulberry32), so a failure reproduces. */
function random(seed: number): () => number {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// The Rust engine reproduces three JavaScript built-ins exactly (crates/heda-core/src/js.rs);
// these compare them with the real ones on many inputs.

describe('toFixedJs matches Number.prototype.toFixed', () => {
	it('on exact binary ties, where Rust formatting would round to even', () => {
		// k / 2^m values: every one with a 5 in the last place is an exact tie.
		for (let digits = 0; digits <= 6; digits += 1) {
			for (let k = -4096; k <= 4096; k += 1) {
				const value = k / 2 ** (digits + 1);
				expect(toFixedJs(value, digits), `${value}.toFixed(${digits})`).toBe(value.toFixed(digits));
			}
		}
	});

	it('on 200 000 random values across the magnitudes heda produces', () => {
		const next = random(2026);
		for (let index = 0; index < 200_000; index += 1) {
			const magnitude = 10 ** Math.floor(next() * 12 - 4);
			const value = (next() - 0.5) * 2 * magnitude;
			const digits = Math.floor(next() * 7);
			const expected = value.toFixed(digits);
			const actual = toFixedJs(value, digits);
			if (actual !== expected) expect(actual, `${value}.toFixed(${digits})`).toBe(expected);
			if (roundJs(value, digits) !== Number(expected)) {
				expect(roundJs(value, digits), `Number(${value}.toFixed(${digits}))`).toBe(
					Number(expected)
				);
			}
		}
	});

	it('on decimal literals typed by hand (values just off a tie)', () => {
		for (const [value, digits] of [
			[1.005, 2],
			[0.615, 2],
			[8.345, 2],
			[1.45, 1],
			[2.675, 2],
			[1.0049999999999999, 2],
			[0, 2],
			[-0, 2],
			[-0.001, 2]
		] as const) {
			expect(toFixedJs(value, digits), `${value}.toFixed(${digits})`).toBe(value.toFixed(digits));
		}
	});
});

describe('numberFromStr matches Number(string)', () => {
	it('on the literal forms and the words JavaScript rejects', () => {
		for (const text of [
			'12',
			' 12\n',
			'\t3.5 ',
			'',
			'   ',
			'1.',
			'.5',
			'-1.5e3',
			'+2',
			'1E-7',
			'0x1F',
			'0o17',
			'0b101',
			'Infinity',
			'-Infinity',
			'+Infinity',
			'1/2',
			'abc',
			'inf',
			'nan',
			'NaN',
			'1e',
			'.',
			'-0x10',
			'1_000',
			'1,5',
			'e5',
			'0x',
			'00012',
			'1e400',
			'\u00a07\u2028',
			'١٢'
		]) {
			expect(numberFromStr(text), JSON.stringify(text)).toBe(Number(text));
		}
	});

	it('on 100 000 random decimal strings', () => {
		const next = random(7);
		for (let index = 0; index < 100_000; index += 1) {
			const text = (next() < 0.5 ? '-' : '') + (next() * 10 ** Math.floor(next() * 10)).toString();
			expect(numberFromStr(text)).toBe(Number(text));
		}
	});
});

describe('hypot matches V8 Math.hypot', () => {
	it('bit for bit on 200 000 random pairs', () => {
		const next = random(141);
		for (let index = 0; index < 200_000; index += 1) {
			const a = next() * 10 ** (next() * 8 - 4);
			const b = next() * 10 ** (next() * 8 - 4);
			if (hypot(a, b) !== Math.hypot(a, b))
				expect(hypot(a, b), `hypot(${a}, ${b})`).toBe(Math.hypot(a, b));
		}
	});
});
