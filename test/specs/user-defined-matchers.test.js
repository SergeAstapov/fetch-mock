import { describe, expect, it } from 'vitest';

const { fetchMock } = testGlobals;
describe('user defined matchers', () => {
	it('match on sync property', async () => {
		const fm = fetchMock.createInstance();
		fm.addMatcher({
			name: 'syncMatcher',
			matcher: (route) => (url) => url.indexOf(route.syncMatcher) > -1,
		});
		fm.mock(
			{
				syncMatcher: 'a',
			},
			200,
		).catch();
		await fm.fetchHandler('http://b.com');
		expect(fm.calls(true).length).toEqual(0);
		await fm.fetchHandler('http://a.com');
		expect(fm.calls(true).length).toEqual(1);
	});

	it('match on async body property', async () => {
		const fm = fetchMock.createInstance();
		fm.addMatcher({
			name: 'bodyMatcher',
			matcher: (route) => (url, options) =>
				JSON.parse(options.body)[route.bodyMatcher] === true,
			usesBody: true,
		});
		fm.mock(
			{
				bodyMatcher: 'a',
			},
			200,
		).catch();
		await fm.fetchHandler(
			new fm.config.Request('http://a.com', {
				method: 'POST',
				body: JSON.stringify({ b: true }),
			}),
		);
		expect(fm.calls(true).length).toEqual(0);
		await fm.fetchHandler(
			new fm.config.Request('http://a.com', {
				method: 'POST',
				body: JSON.stringify({ a: true }),
			}),
		);
		await fm.fetchHandler('http://a.com', {
			method: 'POST',
			body: JSON.stringify({ a: true }),
		});
		expect(fm.calls(true).length).toEqual(2);
	});

	it('not match on async body property without passing `usesBody: true`', () => {
		const fm = fetchMock.createInstance();
		fm.addMatcher({
			name: 'asyncBodyMatcher',
			matcher: (route) => (url, options) =>
				JSON.parse(options.body)[route.asyncBodyMatcher] === true,
		});
		fm.mock(
			{
				asyncBodyMatcher: 'a',
			},
			200,
		).catch();
		expect(() =>
			fm.fetchHandler(
				new fm.config.Request('http://a.com', {
					method: 'POST',
					body: JSON.stringify({ a: true }),
				}),
			),
		).toThrow();
	});
});
