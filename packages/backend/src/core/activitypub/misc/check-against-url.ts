import type { IObject } from '../type.js';

/**
 * Only trust an ActivityPub object served from its own id. A requested alias
 * may redirect to the canonical id, but a document at another path must not
 * claim that id, even when both paths are on the same server.
 */
export function assertActivityMatchesUrls(requestUrl: string | URL, activity: IObject, responseUrl: string | URL): void {
	if (typeof activity.id !== 'string' || activity.id.length === 0) {
		throw new Error('bad Activity: missing id field');
	}

	const request = requestUrl instanceof URL ? requestUrl : new URL(requestUrl);
	const id = new URL(activity.id);
	const response = responseUrl instanceof URL ? responseUrl : new URL(responseUrl);

	if (request.protocol === 'https:' && id.protocol !== 'https:') {
		throw new Error(`bad Activity: id(${activity.id}) downgraded from https`);
	}

	// The authority claimed by the object's id must be the authority we asked.
	if (request.host !== id.host) {
		throw new Error(`bad Activity: id(${activity.id}) has different authority from request(${request.href})`);
	}

	if (response.href !== id.href) {
		throw new Error(`bad Activity: id(${activity.id}) does not match response(${response.href})`);
	}

	if (request.protocol === 'https:' && response.protocol !== 'https:') {
		throw new Error(`bad Activity: response for request(${request.href}) was downgraded from https`);
	}
}
