import { describe, test, assert, vi, afterEach, beforeEach, expect } from 'vitest';
import anim from '../../src/directives/anim';

describe('anim directive', () => {
    let el: HTMLElement;

    beforeEach(() => {
        el = document.createElement('div');
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    test('sets initial style in beforeMount', () => {
        // Mock style since jsdom elements have style but we want to be sure
        const binding = { value: null } as any;
        const vn = {} as any;

        (anim as any).beforeMount(el, binding, vn);

        assert.strictEqual(el.style.opacity, '0');
        assert.strictEqual(el.style.transform, 'scale(0.9)');
        assert.isTrue(el.classList.contains('_zoom'));
    });

    test('animates to visible in mounted', () => {
        const binding = { value: null } as any;
        const vn = {} as any;

        // Apply initial state
        (anim as any).beforeMount(el, binding, vn);
        
        // Trigger mounted
        (anim as any).mounted(el, binding, vn);

        // Should wait 1ms
        expect(el.style.opacity).toBe('0');
        vi.advanceTimersByTime(1);
        
        expect(el.style.opacity).toBe('1');
        expect(el.style.transform).toBe('none');
    });
});
