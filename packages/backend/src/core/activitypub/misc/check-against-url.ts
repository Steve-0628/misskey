import type { IObject } from '../type.js';

function normalizeHost(url: URL): string {
	return url.host.toLowerCase().replace(/^www\./, '');
}

/**
 * Bind a fetched ActivityPub object to the authority in its `id` field.
 * `url` is deliberately not accepted as a substitute for `id`.
 */
export function assertActivityMatchesUrls(requestUrl: string | URL, activity: IObject, candidateUrls: (string | URL)[]): void {
	if (typeof activity.id !== 'string' || activity.id.length === 0) {
		throw new Error('bad Activity: missing id field');
	}

	const request = requestUrl instanceof URL ? requestUrl : new URL(requestUrl);
	const id = new URL(activity.id);
	const candidates = candidateUrls.map(url => url instanceof URL ? url : new URL(url));

	if (request.protocol === 'https:' && id.protocol !== 'https:') {
		throw new Error(`bad Activity: id(${activity.id}) downgraded from https`);
	}

	// The authority claimed by the object's id must be the authority we asked.
	if (normalizeHost(request) !== normalizeHost(id)) {
		throw new Error(`bad Activity: id(${activity.id}) has different authority from request(${request.href})`);
	}

	// Redirects must not move the ActivityPub representation to an unrelated
	// authority. A same-authority canonical path redirect is fine.
	if (!candidates.some(candidate => normalizeHost(candidate) === normalizeHost(id))) {
		throw new Error(`bad Activity: id(${activity.id}) has different authority from response(${candidates.map(x => x.href)})`);
	}

	if (id.protocol === 'https:' && candidates.some(candidate => candidate.protocol !== 'https:')) {
		throw new Error(`bad Activity: response for id(${activity.id}) was downgraded from https`);
	}
}
