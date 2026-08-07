import * as http from 'node:http';
import * as https from 'node:https';
import * as net from 'node:net';
import ipaddr from 'ipaddr.js';
import CacheableLookup from 'cacheable-lookup';
import fetch from 'node-fetch';
import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent';
import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { StatusError } from '@/misc/status-error.js';
import { bindThis } from '@/decorators.js';
import { validateContentTypeSetAsActivityPub } from '@/core/activitypub/misc/validator.js';
import { assertActivityMatchesUrls } from '@/core/activitypub/misc/check-against-url.js';
import type { IObject } from '@/core/activitypub/type.js';
import type { Response } from 'node-fetch';
import type { URL } from 'node:url';

export type HttpRequestSendOptions = {
	throwErrorWhenResponseNotOk: boolean;
	validators?: ((res: Response) => void)[];
};

declare module 'node:http' {
	interface Agent {
		createConnection(options: net.NetConnectOpts, callback?: (err: unknown, stream: net.Socket) => void): net.Socket;
	}
}

function isPrivateIp(config: Config, ip: string): boolean {
	const parsedIp = ipaddr.parse(ip);

	for (const allowedNetwork of config.allowedPrivateNetworks ?? []) {
		const cidr = ipaddr.parseCIDR(allowedNetwork);
		if (cidr[0].kind() === parsedIp.kind() && parsedIp.match(cidr)) {
			return false;
		}
	}

	return parsedIp.range() !== 'unicast';
}

class HttpRequestServiceAgent extends http.Agent {
	constructor(
		private config: Config,
		options?: http.AgentOptions,
	) {
		super(options);
	}

	public createConnection(options: net.NetConnectOpts, callback?: (err: unknown, stream: net.Socket) => void): net.Socket {
		const socket = super.createConnection(options, callback)
			.on('connect', () => {
				const address = socket.remoteAddress;
				if (process.env.NODE_ENV === 'production' && address && ipaddr.isValid(address) && isPrivateIp(this.config, address)) {
					socket.destroy(new Error(`Blocked address: ${address}`));
				}
			});
		return socket;
	}
}

class HttpsRequestServiceAgent extends https.Agent {
	constructor(
		private config: Config,
		options?: https.AgentOptions,
	) {
		super(options);
	}

	public createConnection(options: net.NetConnectOpts, callback?: (err: unknown, stream: net.Socket) => void): net.Socket {
		const socket = super.createConnection(options, callback)
			.on('connect', () => {
				const address = socket.remoteAddress;
				if (process.env.NODE_ENV === 'production' && address && ipaddr.isValid(address) && isPrivateIp(this.config, address)) {
					socket.destroy(new Error(`Blocked address: ${address}`));
				}
			});
		return socket;
	}
}

@Injectable()
export class HttpRequestService {
	/**
	 * Get http non-proxy agent
	 */
	private http: http.Agent;

	/**
	 * Get https non-proxy agent
	 */
	private https: https.Agent;

	/**
	 * Get http proxy or non-proxy agent
	 */
	public httpAgent: http.Agent;

	/**
	 * Get https proxy or non-proxy agent
	 */
	public httpsAgent: https.Agent;

	constructor(
		@Inject(DI.config)
		private config: Config,
	) {
		const cache = new CacheableLookup({
			maxTtl: 3600,	// 1hours
			errorTtl: 30,	// 30secs
			lookup: false,	// nativeのdns.lookupにfallbackしない
		});

		const agentOptions = {
			keepAlive: true,
			keepAliveMsecs: 30 * 1000,
			lookup: cache.lookup as unknown as net.LookupFunction,
		};

		this.http = new HttpRequestServiceAgent(config, agentOptions);
		this.https = new HttpsRequestServiceAgent(config, agentOptions);

		const maxSockets = Math.max(256, config.deliverJobConcurrency ?? 128);

		this.httpAgent = config.proxy
			? new HttpProxyAgent({
				keepAlive: true,
				keepAliveMsecs: 30 * 1000,
				maxSockets,
				maxFreeSockets: 256,
				scheduling: 'lifo',
				proxy: config.proxy,
			})
			: this.http;

		this.httpsAgent = config.proxy
			? new HttpsProxyAgent({
				keepAlive: true,
				keepAliveMsecs: 30 * 1000,
				maxSockets,
				maxFreeSockets: 256,
				scheduling: 'lifo',
				proxy: config.proxy,
			})
			: this.https;
	}

	/**
	 * Get agent by URL
	 * @param url URL
	 * @param bypassProxy Allways bypass proxy
	 */
	@bindThis
	public getAgentByUrl(url: URL, bypassProxy = false): http.Agent | https.Agent {
		if (bypassProxy || (this.config.proxyBypassHosts || []).includes(url.hostname)) {
			return url.protocol === 'http:' ? this.http : this.https;
		} else {
			return url.protocol === 'http:' ? this.httpAgent : this.httpsAgent;
		}
	}

	@bindThis
	public async getActivityJson(url: string): Promise<IObject> {
		const res = await this.send(url, {
			method: 'GET',
			headers: {
				Accept: 'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
			},
			timeout: 5000,
			size: 1024 * 256,
		}, {
			throwErrorWhenResponseNotOk: true,
			validators: [validateContentTypeSetAsActivityPub],
		});

		const finalUrl = res.url;
		const activity = await res.json() as IObject;
		assertActivityMatchesUrls(url, activity, [finalUrl]);

		return activity;
	}

	@bindThis
	public async getJson<T = unknown>(url: string, accept = 'application/json, */*', headers?: Record<string, string>): Promise<T> {
		const res = await this.send(url, {
			method: 'GET',
			headers: Object.assign({
				Accept: accept,
			}, headers ?? {}),
			timeout: 5000,
			size: 1024 * 256,
		});

		return await res.json() as T;
	}

	@bindThis
	public async getHtml(url: string, accept = 'text/html, */*', headers?: Record<string, string>): Promise<string> {
		const res = await this.send(url, {
			method: 'GET',
			headers: Object.assign({
				Accept: accept,
			}, headers ?? {}),
			timeout: 5000,
		});

		return await res.text();
	}

	@bindThis
	public async send(
		url: string,
		args: {
			method?: string,
			body?: string,
			headers?: Record<string, string>,
			timeout?: number,
			size?: number,
		} = {},
		extra: HttpRequestSendOptions = {
			throwErrorWhenResponseNotOk: true,
			validators: [],
		},
	): Promise<Response> {
		const timeout = args.timeout ?? 5000;

		const controller = new AbortController();
		setTimeout(() => {
			controller.abort();
		}, timeout);

		const res = await fetch(url, {
			method: args.method ?? 'GET',
			headers: {
				'User-Agent': this.config.userAgent,
				...(args.headers ?? {}),
			},
			body: args.body,
			size: args.size ?? 10 * 1024 * 1024,
			agent: (url) => this.getAgentByUrl(url),
			signal: controller.signal,
		});

		if (!res.ok && extra.throwErrorWhenResponseNotOk) {
			throw new StatusError(`${res.status} ${res.statusText}`, res.status, res.statusText);
		}

		if (res.ok) {
			for (const validator of (extra.validators ?? [])) {
				validator(res);
			}
		}

		return res;
	}
}
