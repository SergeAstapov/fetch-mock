import {
	describe, expect, it, beforeAll, vi,
} from 'vitest';

const { fetchMock } = testGlobals;
describe('sandbox', () => {
	let originalFetch;

	beforeAll(() => {
		originalFetch = globalThis.fetch = vi.fn().mockResolvedValue('dummy');
	});

	it('return function', () => {
		const sbx = fetchMock.sandbox();
		expect(typeof sbx).toEqual('function');
	});

	it('inherit settings from parent instance', () => {
		const sbx = fetchMock.sandbox();
		expect(sbx.config).toEqual(fetchMock.config);
	});

	it('implement full fetch-mock api', () => {
		const sbx = fetchMock.sandbox();
		for (const key in fetchMock) { //eslint-disable-line guard-for-in
			expect(typeof sbx[key]).toEqual(typeof fetchMock[key]);
		}
	});

	it('delegate to its own fetch handler', () => {
		const sbx = fetchMock.sandbox().mock('http://a.com', 200);

		vi.spyOn(sbx, 'fetchHandler');

		sbx('http://a.com');
		expect(sbx.fetchHandler).toHaveBeenCalledWith('http://a.com', undefined);
	});

	it("don't interfere with global fetch", () => {
		const sbx = fetchMock.sandbox().mock('http://a.com', 200);

		expect(globalThis.fetch).toEqual(originalFetch);
		expect(globalThis.fetch).not.toEqual(sbx);
	});

	it("don't interfere with global fetch-mock", async () => {
		const sbx = fetchMock.sandbox().mock('http://a.com', 200).catch(302);

		fetchMock.mock('http://b.com', 200).catch(301);

		expect(globalThis.fetch).toEqual(fetchMock.fetchHandler);
		expect(fetchMock.fetchHandler).not.toEqual(sbx);
		expect(fetchMock.fallbackResponse).not.toEqual(sbx.fallbackResponse);
		expect(fetchMock.routes).not.toEqual(sbx.routes);

		const [sandboxed, globally] = await Promise.all([
			sbx('http://a.com'),
			fetch('http://b.com'),
		]);

		expect(sandboxed.status).toEqual(200);
		expect(globally.status).toEqual(200);
		expect(sbx.called('http://a.com')).toBe(true);
		expect(sbx.called('http://b.com')).toBe(false);
		expect(fetchMock.called('http://b.com')).toBe(true);
		expect(fetchMock.called('http://a.com')).toBe(false);
		expect(sbx.called('http://a.com')).toBe(true);
		fetchMock.restore();
	});

	it("don't interfere with other sandboxes", async () => {
		const sbx = fetchMock.sandbox().mock('http://a.com', 200).catch(301);

		const sbx2 = fetchMock.sandbox().mock('http://b.com', 200).catch(302);

		expect(sbx2).not.toEqual(sbx);
		expect(sbx2.fallbackResponse).not.toEqual(sbx.fallbackResponse);
		expect(sbx2.routes).not.toEqual(sbx.routes);

		const [res1, res2] = await Promise.all([
			sbx('http://a.com'),
			sbx2('http://b.com'),
		]);
		expect(res1.status).toEqual(200);
		expect(res2.status).toEqual(200);
		expect(sbx.called('http://a.com')).toBe(true);
		expect(sbx.called('http://b.com')).toBe(false);
		expect(sbx2.called('http://b.com')).toBe(true);
		expect(sbx2.called('http://a.com')).toBe(false);
	});

	it('can be restored', async () => {
		const sbx = fetchMock.sandbox().get('https://a.com', 200);

		const res = await sbx('https://a.com');
		expect(res.status).toEqual(200);

		sbx.restore().get('https://a.com', 500);

		const res2 = await sbx('https://a.com');
		expect(res2.status).toEqual(500);
	});

	it("can 'fork' existing sandboxes or the global fetchMock", () => {
		const sbx1 = fetchMock.sandbox().mock(/a/, 200).catch(300);

		const sbx2 = sbx1.sandbox().mock(/b/, 200).catch(400);

		expect(sbx1.routes.length).toEqual(1);
		expect(sbx2.routes.length).toEqual(2);
		expect(sbx1.fallbackResponse).toEqual(300);
		expect(sbx2.fallbackResponse).toEqual(400);
		sbx1.restore();
		expect(sbx1.routes.length).toEqual(0);
		expect(sbx2.routes.length).toEqual(2);
	});

	it('error if spy() is called and no fetch defined in config', () => {
		const fm = fetchMock.sandbox();
		delete fm.config.fetch;
		expect(() => fm.spy()).toThrow();
	});

	it("don't error if spy() is called and fetch defined in config", () => {
		const fm = fetchMock.sandbox();
		fm.config.fetch = originalFetch;
		expect(() => fm.spy()).not.toThrow();
	});

	it('exports a properly mocked node-fetch module shape', () => {
		// uses node-fetch default require pattern
		const {
			default: fetch, Headers, Request, Response,
		} = fetchMock.sandbox();

		expect(fetch.name).toEqual('fetchMockProxy');
		expect(new Headers()).toBeInstanceOf(fetchMock.config.Headers);
		expect(new Request('http://a.com')).toBeInstanceOf(
			fetchMock.config.Request,
		);
		expect(new Response()).toBeInstanceOf(fetchMock.config.Response);
	});
});
