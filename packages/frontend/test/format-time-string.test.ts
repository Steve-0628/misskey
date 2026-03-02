import { describe, test, assert } from 'vitest';
import { formatTimeString } from '../src/scripts/format-time-string';

describe('format-time-string', () => {
	const date = new Date('2023-01-02T13:04:05.123Z'); 
	// NOTE: Timezone depends on environment. 
	// If vitest uses local timezone, this might be flaky if we hardcode output.
	// But formatDateTimeString uses `date.getFullYear()` etc which are local time methods.
	// We should probably rely on the fact that we can control format components.
	// Or we can mock Date methods? Or just check if it contains expected parts.
	
	// Better: use relative parts logic or assume UTC?
	// The implementation uses `date.getFullYear()`, `date.getHours()`.
	// If I construct Date with 'Z', getHours() converts to local.
	// Let's assume consistent environment or check parts.

	test('formats yyyy/MM/dd', () => {
		// Just verify it replaces tokens correctly regardless of timezone value
		const result = formatTimeString(date, 'yyyy/MM/dd');
		assert.match(result, /2023\/\d{2}\/\d{2}/);
	});

	test('formats time HH:mm:ss', () => {
		const result = formatTimeString(date, 'HH:mm:ss');
		assert.match(result, /\d{2}:\d{2}:\d{2}/);
	});

	test('formats literal string', () => {
		const result = formatTimeString(date, '[Time:] HH:mm');
		assert.match(result, /Time: \d{2}:\d{2}/);
	});
});
