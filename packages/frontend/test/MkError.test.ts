import { describe, test, assert, afterEach } from 'vitest';
import { render, cleanup, fireEvent, type RenderResult } from '@testing-library/vue';
import './init';
import MkError from '../src/components/global/MkError.vue';
import { components } from '@/components';

describe('MkError', () => {
	afterEach(() => {
		cleanup();
	});

	test('should render error message and retry button', async () => {
		const wrapper = render(MkError, {
			global: {
				components,
				// Mock the transition to render immediately without waiting
				stubs: {
					Transition: {
						template: '<div><slot /></div>',
					},
				},
			},
		});

		// Check default text: i18n.ts.somethingHappened
		// Actual rendered text is "An error has occurred" (en-US)
		const text = await wrapper.findByText('An error has occurred');
		assert.exists(text);

		// Check retry button text: i18n.ts.retry ("Retry")
		const button = await wrapper.findByText('Retry');
		assert.exists(button);
	});

	test('should emit retry event when button clicked', async () => {
		const wrapper = render(MkError, {
			global: {
				components,
				stubs: {
					Transition: {
						template: '<div><slot /></div>',
					},
				},
			},
		});

		const button = await wrapper.findByText('Retry');
		await fireEvent.click(button);

		// Check emitted event
		assert.strictEqual(wrapper.emitted().retry.length, 1);
	});
});
