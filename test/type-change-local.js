'use strict';

const Debug			= require('debug');
const debug			= new Debug('sharedb-jsproxy:test:type-change:local');
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

describe('type change local', function() {

	beforeEach(async function() {
		this.backend = new Backend();
		this.connection = this.backend.connect();
		this.connection.debug = sharedbDebug.enabled;

		const doc = this.doc = this.connection.get('dogs', 'fido');
		await ShareDBPromises.doc(doc).subscribe();
		await ShareDBPromises.doc(doc).create({name: 'fido'});

		this.docProxy = new ShareDBJSProxy(doc);
	});

	it('undefined to string', async function () {
		const { docProxy } = this;

		return new Promise(async (resolve, reject) => {
			let eventCount = 0;
			const skipEventCount = 2;
			docProxy.__proxy__.on('change', event => {
				debug("event", event);
				try {
					expect(event.prop).to.eql('color');
					expect(event.data).to.eql('white');
					resolve();
				} catch(err) {
					if(eventCount < skipEventCount) {
						debug("Skipping",++eventCount,"/",skipEventCount,"events", err);
						return;
					}
					reject(err);
				}
			});

			docProxy.color = 'white';
		});
	});

	it('string to array', async function () {
		const { docProxy } = this;

		return new Promise(async (resolve, reject) => {
			let eventCount = 0;
			const skipEventCount = 2;
			docProxy.__proxy__.on('change', event => {
				debug("event", event);
				try {
					expect(event.prop).to.eql('name');
					expect(event.data).to.eql(['snoopy', 'droopy']);
					resolve();
				} catch(err) {
					if(eventCount < skipEventCount) {
						debug("Skipping",++eventCount,"/",skipEventCount,"events", err);
						return;
					}
					reject(err);
				}
			});

			docProxy.name = ['snoopy', 'droopy'];
		});
	});

});
