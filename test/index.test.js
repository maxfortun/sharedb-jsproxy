'use strict';

const debug				= require('debug')('sharedb-jsproxy:test');
const expect			= require('chai').expect;

const Backend			= require('sharedb/lib/backend');

const ShareDBJSProxy	= require('../index.js');

describe('ShareDB JS Proxy', function() {
		beforeEach(async function() {
			this.backend = new Backend();
			this.connection = this.backend.connect();
			this.doc = this.connection.get('dogs', 'fido');
	
			const self = this;
			return new Promise((resolve, reject) => {	
				self.doc.create({name: 'fido'}, function(err) {
					if(err) { return reject(err); }
					resolve(self.doc);
				});
			});
		});

		it('should create a proxy to a document', function () {
			const docProxy = new ShareDBJSProxy(this.doc);
		});
});
