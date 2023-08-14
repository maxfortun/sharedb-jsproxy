'use strict';

const Debug			= require('debug');
const debug			= new Debug('sharedb-jsproxy:test:string:local');
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

describe('string local', function() {
	beforeEach(async function() {
		this.backend = new Backend();
		this.connection = this.backend.connect();
		this.connection.debug = sharedbDebug.enabled;

		this.doc = this.connection.get('dogs', 'fido');
		await ShareDBPromises.create(this.doc, {name: 'fido'});
		this.docProxy = new ShareDBJSProxy(this.doc);
	});

	it('new', async function () {
		this.docProxy.color = 'white';
		await this.docProxy.color;
		expect(this.doc.data.color).equal('white');
	});

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
});
