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

const ShareDBPromises	= require('sharedb-promises');
const ShareDBJSProxy	= require('../index.js');

describe('object local', async function() {

	beforeEach(async function() {
		this.backend = new Backend();
		this.connection = this.backend.connect();
		this.connection.debug = sharedbDebug.enabled;

		const doc = this.doc = this.connection.get('dogs', 'fido');
		await ShareDBPromises.doc(doc).subscribe();
		await ShareDBPromises.doc(doc).create({name: 'fido'});

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
			docProxy.__proxy__.on('change', async event => {
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
		});
	});

	it('change', async function () {
		const { docProxy, prop, data } = this;

		await new Promise(async (resolve, reject) => {
			function listener(event) {
				debug("event", event);
				try {
					expect(event.path).to.eql([prop]);
					expect(event.data).to.eql(data);
					resolve();
				} catch(err) {
					debug({err});
					reject(err);
				} finally {
					debug("removing listener");
					docProxy.__proxy__.off('change', listener);
					debug("removed listener");
				}
			}
			docProxy.__proxy__.on('change', listener);

			docProxy[prop] = data;
			await docProxy[prop];
		});

		debug("data init");

		const promise = await new Promise(async (resolve, reject) => {
			let eventCount = 0;
			const skipEventCount = 1;

			function listener(event) {
				debug("event", event);
				try {
					expect(event.path).to.eql([prop, 'fl']);
					expect(event.data).to.eql('up');
					resolve();
				} catch(err) {
					if(eventCount < skipEventCount) {
						debug("Skipping",++eventCount,"/",skipEventCount,"events", err);
						return;
					}

					debug({err});
					reject(err);
				}
			}
			docProxy.__proxy__.on('change', listener);

			try {
				const dataProxy = await docProxy[prop];
				dataProxy.fl = 'up';
				await dataProxy.fl;
			} catch(e) {
				reject(e);
			}
		});

		return promise;
	});

	it('unchanged', async function () {
		const { docProxy, prop, data } = this;

		await new Promise(async (resolve, reject) => {
			function listener(event) {
				debug("event", event);
				try {
					expect(event.path).to.eql([prop]);
					expect(event.data).to.eql(data);
					resolve();
				} catch(err) {
					debug({err});
					reject(err);
				} finally {
					debug("removing listener");
					docProxy.__proxy__.off('change', listener);
					debug("removed listener");
				}
			}
			docProxy.__proxy__.on('change', listener);

			docProxy[prop] = data;
			await docProxy[prop];
		});

		debug("repeating");
		const promise = await new Promise(async (resolve, reject) => {
			function listener(event) {
				debug("event", event);
				try {
					expect(event.path).to.eql([prop, 'fl']);
					expect(event.data).to.eql('down');
					resolve();
				} catch(err) {
					debug({err});
					reject(err);
				}
			}
			docProxy.__proxy__.on('unchanged', listener);

			try {
				const dataProxy = await docProxy[prop];
				dataProxy.fl = 'down';
				await dataProxy.fl;
			} catch(e) {
				reject(e);
			}
		});

		return promise;
	});

});
