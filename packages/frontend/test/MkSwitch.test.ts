
import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/vue';
import './init';
import MkSwitch from '../src/components/MkSwitch.vue';

afterEach(() => {
    cleanup();
});


// Mock directive
const mockTooltip = {
    mounted: (el: any, binding: any) => {
        el.setAttribute('title', binding.value);
    },
    updated: (el: any, binding: any) => {
        el.setAttribute('title', binding.value);
    }
};

describe('MkSwitch', () => {
    test('renders with default state', () => {
        render(MkSwitch, {
            global: {
                directives: {
                    tooltip: mockTooltip
                }
            },
            props: {
                modelValue: false,
            }
        });

        // Check if button exists (it has class 'button', we can find by that or structure)
        // Since we mocked tooltip to set title, we can check title.
        // i18n keys might be raw strings if not fully loaded, but init.ts loads en-US.
        // itsOff -> "Off" usually.
        // But let's check class usage or role if available. It has no role.
        // We can check if `checked` class is absent on root.
        // We need to access container.
    });

    test('toggles state on click', async () => {
        const { emitted, container } = render(MkSwitch, {
            global: {
                directives: {
                    tooltip: mockTooltip
                }
            },
            props: {
                modelValue: false,
            }
        });

        // Click the toggle button
        const button = container.querySelector('[data-cy-switch-toggle]');
        await fireEvent.click(button as Element);

        expect(emitted()['update:modelValue']).toBeTruthy();
        expect(emitted()['update:modelValue'][0]).toEqual([true]);
    });

    test('updates view when prop changes', async () => {
        const { container, rerender } = render(MkSwitch, {
            global: {
                directives: {
                    tooltip: mockTooltip
                }
            },
            props: {
                modelValue: false,
            }
        });

        const button = container.querySelector('[data-cy-switch-toggle]');
        // Initial state (false) -> title should be Off
        // we can't easily know exact string without i18n, but we expect it to change.
        const titleOff = button?.getAttribute('title');

        await rerender({ modelValue: true });
        
        const titleOn = button?.getAttribute('title');
        expect(titleOn).not.toBe(titleOff);
        expect(titleOn).toBeTruthy();
    });

    test('renders slots', () => {
        render(MkSwitch, {
            global: {
                directives: {
                    tooltip: mockTooltip
                }
            },
            props: {
                modelValue: false,
            },
            slots: {
                default: 'Label Text',
                caption: 'Caption Text'
            }
        });

        expect(screen.getByText('Label Text')).toBeTruthy();
        expect(screen.getByText('Caption Text')).toBeTruthy();
    });
});
