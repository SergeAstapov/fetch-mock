//@type-check
import {builtInMatchers, isUrlMatcher, isFunctionMatcher} from './Matchers';
/** @typedef {import('./Matchers').RouteMatcher} RouteMatcher */
/** @typedef {import('./Matchers').RouteMatcherFunction} RouteMatcherFunction */
/** @typedef {import('./Matchers').RouteMatcherUrl} RouteMatcherUrl */
/** @typedef {import('./Matchers').MatcherDefinition} MatcherDefinition */
/** @typedef {import('./FetchMock').FetchMockConfig} FetchMockConfig */

/**
 * @typedef RouteResponseConfig {
 * @property {string | {}} [body]
 * @property {number} [status]
 * @property {{ [key: string]: string }} [headers]
 * @property {Error} [throws]
 * @property {string} [redirectUrl]
 */

/** @typedef {Response| RouteResponseConfig | number| string | Object }  RouteResponseData */
/** @typedef {Promise<RouteResponseData>}  RouteResponsePromise */
/** @typedef {function(string, RequestInit, Request=): (RouteResponseData|RouteResponsePromise)} RouteResponseFunction */
/** @typedef {RouteResponseData | RouteResponsePromise | RouteResponseFunction} RouteResponse*/

/** @typedef {string} RouteName */

/**
 * @typedef RouteConfig
 * @property {RouteName} [name]
 * @property {string} [method]
 * @property {{ [key: string]: string | number  }} [headers]
 * @property {{ [key: string]: string }} [query]
 * @property {{ [key: string]: string }} [params]
 * @property {object} [body]
 * @property {RouteMatcherFunction} [functionMatcher]
 * @property {RouteMatcher} [matcher]
 * @property {RouteMatcherUrl} [url]
 * @property {boolean} [overwriteRoutes]
 * @prop {RouteResponse | RouteResponseFunction} [response]
 * @prop {number} [repeat]
 * @prop {number} [delay]
 * @prop {boolean} [sendAsJson]
 * @prop {boolean} [includeContentLength]
 * @prop {boolean} [matchPartialBody]
 * @prop {boolean} [sticky]
 * @prop {boolean} [usesBody]
 * @prop {boolean} [isFallback]
 */


function sanitizeStatus(status) {
	if (!status) {
		return 200;
	}

	if (
		(typeof status === 'number' &&
			parseInt(status, 10) !== status &&
			status >= 200) ||
		status < 600
	) {
		return status;
	}

	throw new TypeError(`fetch-mock: Invalid status ${status} passed on response object.
To respond with a JSON object that has status as a property assign the object to body
e.g. {"body": {"status: "registered"}}`);
}


/** 
 * @class Route 
 */
class Route {
	/**
	 * @param {RouteConfig} config
	 */
	constructor(config) {
		this.config = config;
		this.#sanitize();
		this.#validate();
		this.#generateMatcher();
		this.#limit();
		this.#delayResponse();
	}

	/** @type {RouteConfig} */
	config = {}
	/** @type {RouteMatcherFunction=} */
	matcher = null

	/**
	 * @returns {void}
	 */
	// @ts-ignore
	#validate() { 
		if (!('response' in this)) {
			throw new Error('fetch-mock: Each route must define a response');
		}

		if (!Route.registeredMatchers.some(({ name }) => name in this)) {
			throw new Error(
				"fetch-mock: Each route must specify some criteria for matching calls to fetch. To match all calls use '*'",
			);
		}
	}
	/**
	 * @returns {void}
	 */
	// @ts-ignore
	#sanitize() {
		if (this.config.method) {
			this.config.method = this.config.method.toLowerCase();
		}
		if (isUrlMatcher(this.config.matcher)) {
			this.config.url = this.config.matcher;
			delete this.config.matcher;
		}
		if (isFunctionMatcher(this.config.matcher)) {
			this.config.functionMatcher = this.config.matcher;
		}
		
	}
	/**
	 * @returns {void}
	 */
	// @ts-ignore
	#generateMatcher() {
		const activeMatchers = Route.registeredMatchers
			.map(({ name, matcher, usesBody }) => {
				if (name in this.config) {
					return { matcher: matcher(this.config), usesBody };
				}
			})
			.filter((matcher) => Boolean(matcher));

		this.config.usesBody = activeMatchers.some(
			({ usesBody }) => usesBody,
		);
		/** @type {RouteMatcherFunction} */
		this.matcher = (url, options = {}, request) =>
			activeMatchers.every(({ matcher }) => matcher(url, options, request));
	}
	/**
	 * @returns {void}
	 */
	// @ts-ignore
	#limit() {
		if (!this.config.repeat) {
			return;
		}
		const originalMatcher = this.matcher;
		let timesLeft = this.config.repeat;
		this.matcher = (url, options, request) => {
			const match = timesLeft && originalMatcher(url, options, request);
			if (match) {
				timesLeft--;
				return true;
			}
		};
		this.reset = () => {
			timesLeft = this.config.repeat;
		};
	}
	/**
	 * @returns {void}
	 */
	// @ts-ignore
	#delayResponse() {
		if (this.config.delay) {
			const { response } = this.config;
			this.config.response = () => {
				return new Promise((res) =>
					setTimeout(() => res(response), this.config.delay),
				);
			};
		}
	}

	constructResponse(responseInput) {
		const responseOptions = this.constructResponseOptions(responseInput);
		const body = this.constructResponseBody(responseInput, responseOptions);

		return new this.config.Response(
			body,
			responseOptions,
		);
	}

	constructResponseOptions(responseInput) {
		const options = responseInput.options || {};
		options.url = responseInput.redirectUrl || this.config.url;
		options.status = sanitizeStatus(responseInput.status);
		options.statusText = statusTextMap[String(options.status)];

		// Set up response headers. The empty object is to cope with
		// new Headers(undefined) throwing in Chrome
		// https://code.google.com/p/chromium/issues/detail?id=335871
		options.headers = new this.config.Headers(
			responseInput.headers || {},
		);
		return options;
	}

	constructResponseBody(responseInput, responseOptions) {
		// start to construct the body
		let body = responseInput.body;
		// convert to json if we need to
		if (
			this.config.sendAsJson &&
			responseInput.body != null && //eslint-disable-line
			typeof body === 'object'
		) {
			body = JSON.stringify(body);
			if (!responseOptions.headers.has('Content-Type')) {
				responseOptions.headers.set('Content-Type', 'application/json');
			}
		}
		this.setContentLength();
		// add a Content-Length header if we need to
		if (
			this.config.includeContentLength &&
			typeof body === 'string' &&
			!responseOptions.headers.has('Content-Length')
		) {
			responseOptions.headers.set('Content-Length', body.length.toString());
		}
		return body
	}

	
	/**
	 * @param {MatcherDefinition} matcher
	 */
	static defineMatcher(matcher) {
		Route.registeredMatchers.push(matcher);
	}
	/** @type {MatcherDefinition[]} */
	static registeredMatchers = [];
}

builtInMatchers.forEach(Route.defineMatcher);

export default Route;
