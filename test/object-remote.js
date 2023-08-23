'use strict';

const Debug			= require('debug');
const debug			= new Debug('sharedb-jsproxy:test:object:remote');
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

describe('object remote', async function() {

	beforeEach(async function() {
		this.backend = new Backend();
		this.connection = this.backend.connect();
		this.connection.debug = sharedbDebug.enabled;

		this.docs = [];
		for(let i = 0; i < 2; i++) {
			const doc = this.docs[i] = this.connection.get('dogs', 'fido');

			await ShareDBPromises.doc(doc).subscribe();
		}

		await ShareDBPromises.doc(this.docs[0]).create({name: 'fido'});

		this.docProxies = this.docs.map(doc => new ShareDBJSProxy(doc));

		this.prop = 'paws';
		this.data = {
			fl: 'down',
			fr: 'down',
			rl: 'down',
			rr: 'down'
		};

	});

	it('new', async function () {
		const { docProxies, prop, data } = this;
		const [ localProxy, remoteProxy ] = docProxies;

		return new Promise(async (resolve, reject) => {
			remoteProxy.__proxy__.on('change', event => {
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

			localProxy[prop] = data;
			await localProxy[prop];
		});
	});

	it('change', async function () {
		const { docProxies, prop, data } = this;
		const [ localProxy, remoteProxy ] = docProxies;

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
					remoteProxy.__proxy__.off('change', listener);
				}
			}
			remoteProxy.__proxy__.on('change', listener);

			localProxy[prop] = data;
			await localProxy[prop];
		});

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
			localProxy.__proxy__.on('change', listener);

			try {
				const dataProxy = await localProxy[prop];
				dataProxy.fl = 'up';
				await dataProxy.fl;
			} catch(e) {
				reject(e);
			}
		});

		return promise;
	});

});
