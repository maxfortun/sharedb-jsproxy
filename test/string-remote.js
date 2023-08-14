'use strict';

const Debug			= require('debug');
const debug			= new Debug('sharedb-jsproxy:test');
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

describe('string remote', function() {
	beforeEach(async function() {
		this.backend = new Backend();
		this.connection = this.backend.connect();
		this.connection.debug = sharedbDebug.enabled;

		this.docs = [];
		for(let i = 0; i < 2; i++) {
			this.docs[i] = this.connection.get('dogs', 'fido');
		}

		await ShareDBPromises.create(this.docs[0], {name: 'fido'});

		for(let i = 1; i < this.docs.length; i++) {
			await ShareDBPromises.fetch(this.docs[i]);
		}

		this.docProxies = this.docs.map(doc => new ShareDBJSProxy(doc));
	});

	it('new', async function () {
		return new Promise((resolve, reject) => {
			const localProxy = this.docProxies[0];
			const remoteProxy = this.docProxies[1];
			remoteProxy.__proxy__.on('change', event => {
				debug("event", event);
				if(event.data !== value) {
					return reject();
				}
				resolve();
			});

			this.docProxies[0].color = 'white';
			// await this.docProxy[1].color;
			// expect(this.doc.data.color).equal('white');
		});
	});

/*
	it('change', async function () {
		this.docProxy = new ShareDBJSProxy(this.doc);
		this.docProxy.name = 'snoopy';
		await this.docProxy.name;
		expect(this.doc.data.name).equal('snoopy');
	});

	it('unchanged', async function () {
		this.docProxy = new ShareDBJSProxy(this.doc);
		this.docProxy.name = 'fido';
		await this.docProxy.name;
		expect(this.doc.data.name).equal('fido');
	});

	it('null', async function () {
		this.docProxy = new ShareDBJSProxy(this.doc);
		this.docProxy.name = null;
		await this.docProxy.name;
		expect(this.doc.data.name).equal(null);
	});

	it('delete', async function () {
		this.docProxy = new ShareDBJSProxy(this.doc);
		delete this.docProxy.name;
		await this.docProxy.name;
		expect(this.doc.data.name).equal(undefined);
	});

	it('should create 2 proxies to the same document', function () {
		this.docProxy = new ShareDBJSProxy(this.doc);
		const doc2 = this.connection.get('dogs', 'fido');
		const doc2Proxy = new ShareDBJSProxy(doc2);
	});
*/

});
