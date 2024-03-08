'use strict';

const Debug			= require('debug');
const debug			= new Debug('sharedb-jsproxy:test:array:local');
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

describe('array local', async function() {

	beforeEach(async function() {
		this.backend = new Backend();
		this.connection = this.backend.connect();
		this.connection.debug = sharedbDebug.enabled;

		const doc = this.doc = this.connection.get('dogs', 'fido');
		await ShareDBPromises.doc(doc).subscribe();
		await ShareDBPromises.doc(doc).create({name: 'fido'});

		this.docProxy = new ShareDBJSProxy(doc);

		this.prop = 'paws';
		this.data = [ 'fl', 'fr', 'rl', 'rr' ]

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

	it('push', async function () {
		const { docProxy, prop, data } = this;
		docProxy.array = [ { name: 'foo' } ]; 	
		const result = await docProxy.array;
		expect(result).to.eql([ { name: 'foo' } ]);

		docProxy.array = [ { name: 'foo' }, { name: 'bar'} ]; 	
		const result2 = await docProxy.array;
		expect(result2).to.eql([ { name: 'foo' }, { name: 'bar'} ]);
	});

	it('pop', async function () {
		const { docProxy, prop, data } = this;
		docProxy.array = [ { name: 'foo' }, { name: 'bar'} ]; 	
		const result = await docProxy.array;
		expect(result).to.eql([ { name: 'foo' }, { name: 'bar'} ]);

		docProxy.array = [ { name: 'foo' } ]; 	
		const result2 = await docProxy.array;
		expect(result2).to.eql([ { name: 'foo' } ]);
	});

	it('unshift', async function () {
		const { docProxy, prop, data } = this;
		docProxy.array = [ { name: 'bar' } ]; 	
		const result = await docProxy.array;
		expect(result).to.eql([ { name: 'bar' } ]);

		docProxy.array = [ { name: 'foo' }, { name: 'bar'} ]; 	
		const result2 = await docProxy.array;
		expect(result2).to.eql([ { name: 'foo' }, { name: 'bar'} ]);
	});

	it('shift', async function () {
		const { docProxy, prop, data } = this;
		docProxy.array = [ { name: 'foo' }, { name: 'bar'} ]; 	
		const result = await docProxy.array;
		expect(result).to.eql([ { name: 'foo' }, { name: 'bar'} ]);

		docProxy.array = [ { name: 'bar' } ]; 	
		const result2 = await docProxy.array;
		expect(result2).to.eql([ { name: 'bar' } ]);
	});

	it('array change', async function () {
		const { docProxy, prop, data } = this;
		docProxy.array = [ { name: 'foo' }, { name: 'bar'}, { name: 'baz'} ]; 	
		const result = await docProxy.array;
		expect(result).to.eql([ { name: 'foo' }, { name: 'bar'}, { name: 'baz'} ]);

		docProxy.array = [ { name: 'foo' }, { name: 'x'}, { name: 'baz'} ]; 	
		const result2 = await docProxy.array;
		expect(result2).to.eql([ { name: 'foo' }, { name: 'x'}, { name: 'baz'} ]);
	});

	it('append to array', async function () {
		const { docProxy, prop, data } = this;
		docProxy.array = [ { name: 'foo' } ]; 	
		const result = await docProxy.array;
		expect(result).to.eql([ { name: 'foo' } ]);

		docProxy.array[1] = { name: 'bar'}; 	
		const result2 = await docProxy.array[1];
		expect(docProxy.array).to.eql([ { name: 'foo' }, { name: 'bar'} ]);
	});
});
