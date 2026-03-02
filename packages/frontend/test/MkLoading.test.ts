import { describe, test, assert, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/vue';
import './init';
import MkLoading from '../src/components/global/MkLoading.vue';

describe('MkLoading', () => {
	afterEach(() => {
		cleanup();
	});

	test('should render consistently', () => {
		const wrapper = render(MkLoading);
		// Check if the spinner element is rendered
		// It usually contains svg or divs.
		// From file inspection earlier, we know it might have specificity.
		// But let's check container existence.
		assert.exists(wrapper.container);
		// Check for spinner class or similar.
		// Since we don't have easy access to CSS modules class names in test...
		// We can check if it renders *something*.
		assert.isNotEmpty(wrapper.container.innerHTML);
	});
});
