'use strict';

const Debug			= require('debug');
const debug			= new Debug('sharedb-jsproxy:test:string:remote');
const sharedbDebug	= new Debug('sharedb-jsproxy:sharedb');

const chai = require('chai');
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

describe('string remote', function() {
	// this.timeout(20000); 

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
	});

	it('change event on create', async function () {
		return new Promise(async (resolve, reject) => {
			const { docProxies } = this;
			const [ localProxy, remoteProxy ] = docProxies;

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
			await localProxy.color;
		});
	});

	it('change event on update', async function () {
		return new Promise(async (resolve, reject) => {
			const { docProxies } = this;
			const [ localProxy, remoteProxy ] = docProxies;

			let eventCount = 0;
			const skipEventCount = 2;
			remoteProxy.__proxy__.on('change', event => {
				debug("event", event);
				try {
					expect(event.prop).to.eql('name');
					expect(event.data).to.eql('snoopy');
					resolve();
				} catch(err) {
					if(eventCount < skipEventCount) {
						debug("Skipping",++eventCount,"/",skipEventCount,"events", err);
						return;
					}
					reject(err);
				}
			});

			localProxy.name = 'snoopy';
		});
	});

	it('change event on null', async function () {
		return new Promise(async (resolve, reject) => {
			const { docProxies } = this;
			const [ localProxy, remoteProxy ] = docProxies;

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

	it('change event on delete', async function () {
		return new Promise(async (resolve, reject) => {
			const { docProxies } = this;
			const [ localProxy, remoteProxy ] = docProxies;

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

	it('update', async function () {
		const { docProxies } = this;
		const [ localProxy, remoteProxy ] = docProxies;

		localProxy.name = 'event123';
		await localProxy.name;
		expect(await remoteProxy.name).to.eql('event123');

		localProxy.name = 'testString1';
		await localProxy.name;
		expect(await remoteProxy.name).to.eql('testString1');
	});

	it('update case change', async function () {
		const { docProxies } = this;
		const [ localProxy, remoteProxy ] = docProxies;

		localProxy.text = 'This is a text.';
		await localProxy.text;
		expect(await remoteProxy.text).to.eql('This is a text.');

		localProxy.text = 'THIS IS A TEXT.';
		await localProxy.text;
		expect(await remoteProxy.text).to.eql('THIS IS A TEXT.');
	});

});
