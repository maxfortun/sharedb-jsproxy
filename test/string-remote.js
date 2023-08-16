'use strict';

const Debug			= require('debug');
const debug			= new Debug('sharedb-jsproxy:test:string:remote');
const sharedbDebug	= new Debug('sharedb-jsproxy:sharedb');

const chai  = require('chai');
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

describe('string remote', function() {
	// this.timeout(20000); 

	beforeEach(async function() {
		this.backend = new Backend();
		this.connection = this.backend.connect();
		this.connection.debug = sharedbDebug.enabled;

		this.docs = [];
		for(let i = 0; i < 2; i++) {
			const doc = this.docs[i] = this.connection.get('dogs', 'fido');

			await ShareDBPromises.subscribe(doc);
		}

		await ShareDBPromises.create(this.docs[0], {name: 'fido'});

		this.docProxies = this.docs.map(doc => new ShareDBJSProxy(doc));
	});

	it('new', async function () {
		return new Promise(async (resolve, reject) => {
			const localProxy = this.docProxies[0];
			const remoteProxy = this.docProxies[1];

			remoteProxy.__proxy__.on('change', event => {
				debug("event", event);
				try {
					expect(event.prop).to.eql('color');
					expect(event.data).to.eql('white');
					resolve();
				} catch(err) {
					reject(err);
				}
			});

			localProxy.color = 'white';
		});
	});

	it('change', async function () {
		return new Promise(async (resolve, reject) => {
			const localProxy = this.docProxies[0];
			const remoteProxy = this.docProxies[1];

			remoteProxy.__proxy__.on('change', event => {
				debug("event", event);
				try {
					expect(event.prop).to.eql('name');
					expect(event.data).to.eql('snoopy');
					resolve();
				} catch(err) {
					reject(err);
				}
			});

			localProxy.name = 'snoopy';
		});
	});

	it('null', async function () {
		return new Promise(async (resolve, reject) => {
			const localProxy = this.docProxies[0];
			const remoteProxy = this.docProxies[1];

			remoteProxy.__proxy__.on('change', event => {
				debug("event", event);
				try {
					expect(event.prop).to.eql('name');
					expect(event.data).to.eql(null);
					resolve();
				} catch(err) {
					reject(err);
				}
			});

			localProxy.name = null;
		});
	});

	it('delete', async function () {
		return new Promise(async (resolve, reject) => {
			const localProxy = this.docProxies[0];
			const remoteProxy = this.docProxies[1];

			remoteProxy.__proxy__.on('change', event => {
				debug("event", event);
				try {
					expect(event.prop).to.eql('name');
					expect(event.data).to.eql(undefined);
					resolve();
				} catch(err) {
					reject(err);
				}
			});

			delete localProxy.name;
		});
	});

});
