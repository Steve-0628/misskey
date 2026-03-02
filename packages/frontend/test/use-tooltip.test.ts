import { describe, test, assert, vi, afterEach, beforeEach, expect } from 'vitest';
import { ref, nextTick } from 'vue';
import { useTooltip } from '../src/scripts/use-tooltip';

describe('useTooltip', () => {
    let el: HTMLElement;
    let elRef: any;
    let onShow: any;

    beforeEach(() => {
        el = document.createElement('div');
        document.body.appendChild(el);
        elRef = ref(el);
        onShow = vi.fn();
        vi.useFakeTimers();
    });

    afterEach(() => {
        document.body.removeChild(el);
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    test('shows tooltip on mouseover after delay', async () => {
        useTooltip(elRef, onShow, 100);
        
        // Trigger event listener attachment (watcher flush: post)
        await nextTick();

        el.dispatchEvent(new MouseEvent('mouseover'));
        
        // Not shown immediately
        expect(onShow).not.toHaveBeenCalled();

        // Advance timer
        vi.advanceTimersByTime(100);

        expect(onShow).toHaveBeenCalled();
        const showingRef = onShow.mock.calls[0][0];
        assert.isTrue(showingRef.value);
    });

    test('hides tooltip on mouseleave', async () => {
        useTooltip(elRef, onShow, 100);
        await nextTick();

        el.dispatchEvent(new MouseEvent('mouseover'));
        vi.advanceTimersByTime(100);
        
        expect(onShow).toHaveBeenCalled();
        const showingRef = onShow.mock.calls[0][0];

        el.dispatchEvent(new MouseEvent('mouseleave'));
        
        assert.isFalse(showingRef.value);
    });

    test('cancels show if mouseleave happens before delay', async () => {
        useTooltip(elRef, onShow, 100);
        await nextTick();

        el.dispatchEvent(new MouseEvent('mouseover'));
        vi.advanceTimersByTime(50); // half way
        el.dispatchEvent(new MouseEvent('mouseleave'));
        vi.advanceTimersByTime(100);

        expect(onShow).not.toHaveBeenCalled();
    });

    test('supports touch events', async () => {
        useTooltip(elRef, onShow, 100);
        await nextTick();

        el.dispatchEvent(new TouchEvent('touchstart'));
        vi.advanceTimersByTime(100);

        expect(onShow).toHaveBeenCalled();
    });

    	test('closes on click', async () => {
		useTooltip(elRef, onShow, 100);
		await nextTick();

		el.dispatchEvent(new MouseEvent('mouseover'));
		vi.advanceTimersByTime(100);
		
		const showingRef = onShow.mock.calls[0][0];
		assert.isTrue(showingRef.value);

		el.dispatchEvent(new MouseEvent('click'));
		assert.isFalse(showingRef.value);
	});

	test('closes on touchend', async () => {
		useTooltip(elRef, onShow, 100);
		await nextTick();

		el.dispatchEvent(new TouchEvent('touchstart'));
		vi.advanceTimersByTime(100);
		
		const showingRef = onShow.mock.calls[0][0];
		assert.isTrue(showingRef.value);

		el.dispatchEvent(new TouchEvent('touchend'));
		assert.isFalse(showingRef.value);
	});
});
