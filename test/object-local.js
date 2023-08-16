'use strict';

const Debug			= require('debug');
const debug			= new Debug('sharedb-jsproxy:test:object:local');
const sharedbDebug	= new Debug('sharedb-jsproxy:sharedb');

const chai	= require('chai');
const { expect } = chai;
chai.config.truncateThreshold = 0;

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

describe('object local', async function() {

	beforeEach(async function() {
		this.backend = new Backend();
		this.connection = this.backend.connect();
		this.connection.debug = sharedbDebug.enabled;

		const doc = this.doc = this.connection.get('dogs', 'fido');
		await ShareDBPromises.subscribe(doc);
		await ShareDBPromises.create(doc, {name: 'fido'});

		this.docProxy = new ShareDBJSProxy(doc);

		this.prop = 'paws';
		this.data = {
			fl: 'down',
			fr: 'down',
			rl: 'down',
			rr: 'down'
		};

	});

	it('new', async function () {
		const { docProxy, prop, data } = this;

		return new Promise(async (resolve, reject) => {
			docProxy.__proxy__.on('change', event => {
				debug("event", event);
				try {
					expect(event.prop).to.eql(prop);
					expect(event.data).to.eql(data);
					resolve();
				} catch(err) {
					debug("err" + err);
					reject(err);
				}
			});

			docProxy[prop] = data;
			await docProxy[prop];
		});
	});

	it('change', async function () {
		const { docProxy, prop, data } = this;

		await new Promise(async (resolve, reject) => {
			docProxy.__proxy__.on('change', event => {
				debug("event", event);
				try {
					expect(event.prop).to.eql(prop);
					expect(event.data).to.eql(data);
					resolve();
				} catch(err) {
					debug("err" + err);
					reject(err);
				}
			});

			docProxy[prop] = data;
			await docProxy[prop];
		});

		data.fr = 'up';
		await new Promise(async (resolve, reject) => {
			docProxy.__proxy__.on('change', event => {
				debug("event", event);
				try {
					expect(event.prop).to.eql(prop);
					expect(event.data).to.eql(data);
					resolve();
				} catch(err) {
					debug("err" + err);
					reject(err);
				}
			});

			docProxy[prop] = data;
			await docProxy[prop];
		});
	});

/*
	it('unchanged', async function () {
		return new Promise(async (resolve, reject) => {
			const docProxy = this.docProxy;

			docProxy.__proxy__.on('unchanged', event => {
				debug("event", event);
				expect(event.prop).to.eql('name');
				expect(event.data).to.eql('fido');
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
				expect(event.prop).to.eql('name');
				expect(event.data).to.eql(null);
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
				expect(event.prop).to.eql('name');
				expect(event.data).to.eql(undefined);
				resolve();
			});

			delete docProxy.name;
			await docProxy.name;
		});
	});
*/

});
