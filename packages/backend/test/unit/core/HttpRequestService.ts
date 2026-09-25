process.env.NODE_ENV = 'test';

import * as http from 'node:http';
import * as net from 'node:net';
import type { AddressInfo } from 'node:net';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import type { Config } from '@/config.js';

function listen(server: http.Server): Promise<number> {
	return new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			server.off('error', reject);
			resolve((server.address() as AddressInfo).port);
		});
	});
}

function close(server: http.Server): Promise<void> {
	return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

describe('HttpRequestService proxy target guard', () => {
	const originalNodeEnv = process.env.NODE_ENV;
	let proxy: http.Server;
	let proxyPort: number;
	let service: HttpRequestService;
	let connectTargets: string[];

	beforeEach(async () => {
		process.env.NODE_ENV = 'production';
		connectTargets = [];
		proxy = http.createServer();
		proxy.on('connect', (request, socket, head) => {
			connectTargets.push(request.url ?? '');
			const target = new URL(`http://${request.url}`);
			const upstream = net.connect(Number(target.port), target.hostname, () => {
				socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
				if (head.length > 0) upstream.write(head);
				upstream.pipe(socket);
				socket.pipe(upstream);
			});
			upstream.on('error', () => socket.destroy());
			socket.on('error', () => upstream.destroy());
		});
		proxyPort = await listen(proxy);
	});

	afterEach(async () => {
		service?.httpAgent.destroy();
		service?.httpsAgent.destroy();
		proxy.closeAllConnections();
		await close(proxy);
		process.env.NODE_ENV = originalNodeEnv;
	});

	function createService(allowedPrivateNetworks?: string[]): HttpRequestService {
		return new HttpRequestService({
			proxy: `http://127.0.0.1:${proxyPort}`,
			userAgent: 'Misskey/test',
			allowedPrivateNetworks,
		} as Config);
	}

	test('blocks a private IP literal before CONNECT', async () => {
		service = createService();

		await expect(service.getJson('http://127.0.0.1:12345/private')).rejects.toThrow('Blocked proxy target');
		expect(connectTargets).toEqual([]);
	});

	test('blocks a hostname resolving to private addresses before CONNECT', async () => {
		service = createService();

		await expect(service.getJson('http://localhost:12345/private')).rejects.toThrow('Blocked proxy target');
		expect(connectTargets).toEqual([]);
	});

	test('permits an explicitly allowed private network through the proxy', async () => {
		const target = http.createServer((_request, response) => {
			response.setHeader('Content-Type', 'application/json');
			response.end('{"ok":true}');
		});
		const targetPort = await listen(target);
		service = createService(['127.0.0.0/8']);

		try {
			await expect(service.getJson(`http://127.0.0.1:${targetPort}/`)).resolves.toEqual({ ok: true });
			expect(connectTargets).toEqual([`127.0.0.1:${targetPort}`]);
		} finally {
			service.httpAgent.destroy();
			target.closeAllConnections();
			await close(target);
		}
	});
});
