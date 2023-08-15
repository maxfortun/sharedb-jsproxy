'use strict';

const Debug			= require('debug');
const debug			= new Debug('sharedb-jsproxy:test:string:remote');
const sharedbDebug	= new Debug('sharedb-jsproxy:sharedb');

const expect	= require('chai').expect;

const logger = {
	info: sharedbDebug,
	warn: sharedbDebug,
	error: sharedbDebug
};

const ShareDB	= require('sharedb');
ShareDB.logger.setMethods(logger);

const Backend	= ShareDB.Backend;

const ShareDBPromises	= require('../util/sharedb-promises.js');
const ShareDBJSProxy	= require('../index.js');

describe('object local', function() {

	beforeEach(async function() {
		this.backend = new Backend();
		this.connection = this.backend.connect();
		this.connection.debug = sharedbDebug.enabled;

		const doc = this.doc = this.connection.get('dogs', 'fido');
		await ShareDBPromises.subscribe(doc);
		await ShareDBPromises.create(doc, {name: 'fido'});

		this.docProxy = new ShareDBJSProxy(doc);
	});

	it('new', async function () {
		return new Promise(async (resolve, reject) => {
			const docProxy = this.docProxy;

			const prop = 'paws';
			const data = {
				fl: 'up',
				fr: 'down',
				rl: 'down',
				rr: 'down'
			};

			docProxy.__proxy__.on('change', event => {
				debug("event", event);
				expect(event.prop).equal(prop);
				expect(event.data).equal(data);
				resolve();
			});

			docProxy[prop] = data;
			await docProxy[prop];
		});
	});

/*
	it('change', async function () {
		return new Promise(async (resolve, reject) => {
			const docProxy = this.docProxy;

			docProxy.__proxy__.on('change', event => {
				debug("event", event);
				expect(event.prop).equal('name');
				expect(event.data).equal('snoopy');
				resolve();
			});

			docProxy.name = 'snoopy';
			await docProxy.name;
		});
	});

	it('unchanged', async function () {
		return new Promise(async (resolve, reject) => {
			const docProxy = this.docProxy;

			docProxy.__proxy__.on('unchanged', event => {
				debug("event", event);
				expect(event.prop).equal('name');
				expect(event.data).equal('fido');
				resolve();
			});

			docProxy.name = 'fido';
			await docProxy.name;
		});
	});

	it('null', async function () {
		return new Promise(async (resolve, reject) => {
			const docProxy = this.docProxy;

			docProxy.__proxy__.on('change', event => {
				debug("event", event);
				expect(event.prop).equal('name');
				expect(event.data).equal(null);
				resolve();
			});

			docProxy.name = null;
			await docProxy.name;
		});
	});

	it('delete', async function () {
		return new Promise(async (resolve, reject) => {
			const docProxy = this.docProxy;

			docProxy.__proxy__.on('change', event => {
				debug("event", event);
				expect(event.prop).equal('name');
				expect(event.data).equal(undefined);
				resolve();
			});

			delete docProxy.name;
			await docProxy.name;
		});
	});
*/

});
