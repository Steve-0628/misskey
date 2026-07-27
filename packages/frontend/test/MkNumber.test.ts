
import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/vue';
import './init';
import MkNumber from '../src/components/MkNumber.vue';

afterEach(() => {
	cleanup();
});

// Mock the number filter since it's used in the template
vi.mock('@/filters/number', () => ({
	default: (n: number) => n.toString(),
}));

describe('MkNumber', () => {
	test('renders the value', async () => {
		render(MkNumber, {
			props: {
				value: 100,
			},
		});

		// Use findByText with regex for flexible matching and built-in wait
		// GSAP tweens from 0 to 100 over 1s, so give it extra time.
		expect(await screen.findByText(/100/, {}, { timeout: 3000 })).toBeTruthy();
	});

	test('updates when value changes', async () => {
		const { rerender } = render(MkNumber, {
			props: {
				value: 100,
			},
		});

		expect(await screen.findByText(/100/)).toBeTruthy();

		await rerender({ value: 200 });

		// GSAP animation might take time, increase timeout
		expect(await screen.findByText(/200/, {}, { timeout: 3000 })).toBeTruthy();
	});
});
