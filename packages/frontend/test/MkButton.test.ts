
import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/vue';
import './init';
import MkButton from '../src/components/MkButton.vue';

// Mock MkA component
const MkA = {
  template: '<a :href="to"><slot /></a>',
  props: ['to'],
};

afterEach(() => {
  cleanup();
});

describe('MkButton', () => {
    test('renders slot content', () => {
        render(MkButton, {
            global: {
                components: { MkA },
            },
            slots: {
                default: 'Click Me',
            },
        });

        expect(screen.getByText('Click Me')).toBeTruthy();
    });

    test('emits click event', async () => {
        const { emitted } = render(MkButton, {
            global: {
                components: { MkA },
            },
        });
        const button = screen.getByRole('button');

        await fireEvent.click(button);

        expect(emitted().click).toBeTruthy();
    });

    test('applies primary class prop', () => {
        const { container } = render(MkButton, {
            global: {
                components: { MkA },
            },
            props: {
                primary: true,
            },
        });

        expect(container.querySelector('button')).toBeTruthy();
    });

    test('renders as anchor when link prop is present', () => {
        render(MkButton, {
            global: {
                components: { MkA },
            },
            props: {
                link: true,
                to: '/test',
            },
            slots: {
                default: 'Link Button',
            },
        });

        expect(screen.getByText('Link Button')).toBeTruthy();
        // Since MkA is mocked as <a>, we can check for link role or tag
        const link = screen.getByRole('link');
        expect(link.getAttribute('href')).toBe('/test');
    });
});
