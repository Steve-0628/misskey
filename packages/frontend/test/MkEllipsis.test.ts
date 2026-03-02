import { describe, test, assert, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/vue';
import './init';
import MkEllipsis from '../src/components/global/MkEllipsis.vue';

describe('MkEllipsis', () => {
	afterEach(() => {
		cleanup();
	});

	test('renders 3 dots', () => {
		const wrapper = render(MkEllipsis);
		const dots = wrapper.container.querySelectorAll('span span');
		assert.strictEqual(dots.length, 3);
		dots.forEach(dot => assert.strictEqual(dot.textContent, '.'));
	});

	test('applies static class if static prop is true', async () => {
		const { rerender, container } = render(MkEllipsis, {
			props: { static: false },
		});
		const classAttrFalse = container.firstElementChild?.getAttribute('class') || '';

		await rerender({ static: true });
		const classAttrTrue = container.firstElementChild?.getAttribute('class') || '';

		// The class attribute should change (adding the static class)
		assert.notStrictEqual(classAttrTrue, classAttrFalse);
		assert.isTrue(classAttrTrue.length > classAttrFalse.length);
	});
});
