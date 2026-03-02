import { describe, test, assert, vi, afterEach, beforeEach, expect } from 'vitest';
import UserPreviewDirective from '../../src/directives/user-preview';

// Mock @/os
const popupSpy = vi.fn();
vi.mock('@/os', () => ({
    popup: (...args: any[]) => {
        popupSpy(...args);
        // Returns promise that resolves to result? Or undefined?
        // In UserPreview source: this.promise = ... (Wait, popup returns a Promise?)
        // Actually looking at source: popup(...) returns Promise<void> usually?
        // UserPreview treats the return of popup call? No.
        // It sets this.promise = { cancel: ... } manually inside show().
        // Wait, line 33: popup(...) isn't awaited or assigned.
        // Line 47: this.promise = { cancel: ... }.
        // So popup return value is ignored.
    },
}));

describe('user-preview directive', () => {
    let el: HTMLElement;
    let user: any;

    beforeEach(() => {
        el = document.createElement('div');
        document.body.appendChild(el);
        user = { id: 'u1', username: 'alice' };
        vi.useFakeTimers();
        popupSpy.mockClear();
    });

    afterEach(() => {
        if (document.body.contains(el)) document.body.removeChild(el);
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    test('attaches event listeners on mounted', () => {
        const addSpy = vi.spyOn(el, 'addEventListener');
        const binding = { value: user } as any;

        (UserPreviewDirective as any).mounted(el, binding, null);

        expect(addSpy).toHaveBeenCalledWith('mouseover', expect.any(Function));
        expect(addSpy).toHaveBeenCalledWith('mouseleave', expect.any(Function));
        expect(addSpy).toHaveBeenCalledWith('click', expect.any(Function));

        // Cleanup
        (UserPreviewDirective as any).unmounted(el, binding, null);
    });

    test('shows popup on mouseover after delay', () => {
        const binding = { value: user } as any;
        (UserPreviewDirective as any).mounted(el, binding, null);

        el.dispatchEvent(new MouseEvent('mouseover'));

        expect(popupSpy).not.toHaveBeenCalled();

        vi.advanceTimersByTime(500);

        expect(popupSpy).toHaveBeenCalled();
        const args = popupSpy.mock.calls[0];
        // args[1] is props
        assert.deepEqual(args[1].q, user);
        assert.strictEqual(args[1].source, el);

        (UserPreviewDirective as any).unmounted(el, binding, null);
    });

    test('hides popup on mouseleave after delay', () => {
        const binding = { value: user } as any;
        (UserPreviewDirective as any).mounted(el, binding, null);

        // Show
        el.dispatchEvent(new MouseEvent('mouseover'));
        vi.advanceTimersByTime(500);
        expect(popupSpy).toHaveBeenCalled();

        const showingRef = popupSpy.mock.calls[0][1].showing;
        assert.isTrue(showingRef.value);

        // Mouseleave triggers hide timer (500ms)
        el.dispatchEvent(new MouseEvent('mouseleave'));

        // Advance partial time, should still be open
        vi.advanceTimersByTime(400);
        assert.isTrue(showingRef.value);

        // Advance past 500ms
        vi.advanceTimersByTime(100); // Total 500
        assert.isFalse(showingRef.value);

        (UserPreviewDirective as any).unmounted(el, binding, null);
    });

    test('cancels show if mouseleave happens before delay', () => {
        const binding = { value: user } as any;
        (UserPreviewDirective as any).mounted(el, binding, null);

        el.dispatchEvent(new MouseEvent('mouseover'));
        vi.advanceTimersByTime(100);
        el.dispatchEvent(new MouseEvent('mouseleave'));
        vi.advanceTimersByTime(500);

        expect(popupSpy).not.toHaveBeenCalled();

        (UserPreviewDirective as any).unmounted(el, binding, null);
    });
});
