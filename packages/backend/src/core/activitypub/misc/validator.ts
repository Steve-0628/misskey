import type { Response } from 'node-fetch';

const ACTIVITYSTREAMS_PROFILE = 'https://www.w3.org/ns/activitystreams';

function parseContentType(contentType: string): { mediaType: string; parameters: Map<string, string> } {
	const [rawMediaType, ...rawParameters] = contentType.split(';');
	const parameters = new Map<string, string>();

	for (const rawParameter of rawParameters) {
		const separator = rawParameter.indexOf('=');
		if (separator === -1) continue;

		const name = rawParameter.slice(0, separator).trim().toLowerCase();
		let value = rawParameter.slice(separator + 1).trim();
		if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
			value = value.slice(1, -1);
		}
		parameters.set(name, value);
	}

	return {
		mediaType: rawMediaType.trim().toLowerCase(),
		parameters,
	};
}

export function validateContentTypeSetAsActivityPub(response: Response): void {
	const contentType = response.headers.get('content-type');
	if (contentType == null || contentType.trim() === '') {
		throw new Error('Validate content type of AP response: No content-type header');
	}

	const { mediaType, parameters } = parseContentType(contentType);
	if (mediaType === 'application/activity+json') return;

	if (mediaType === 'application/ld+json') {
		const profiles = parameters.get('profile')?.split(/\s+/) ?? [];
		if (profiles.some(profile => profile === ACTIVITYSTREAMS_PROFILE)) return;
	}

	throw new Error('Validate content type of AP response: Content type is not application/activity+json or application/ld+json');
}

const plusJsonSuffixRegex = /^(?:application|text)\/[a-zA-Z0-9.!#$%&'*+\-^_`|~]+\+json$/;

export function validateContentTypeSetAsJsonLD(response: Response): void {
	const contentType = response.headers.get('content-type');
	if (contentType == null || contentType.trim() === '') {
		throw new Error('Validate content type of JSON LD: No content-type header');
	}

	const { mediaType } = parseContentType(contentType);
	if (
		mediaType === 'application/ld+json' ||
		mediaType === 'application/json' ||
		plusJsonSuffixRegex.test(mediaType)
	) {
		return;
	}
	throw new Error('Validate content type of JSON LD: Content type is not application/ld+json or application/json');
}
