'use strict';

const Debug				= require('debug');
const EventEmitter		= require('events');

const ShareDBPromises   = require('./util/sharedb-promises.js');

class ShareDBJSProxy extends EventEmitter {
	static count = 0;

	constructor(doc, options) {
		if(!options) {
			options = {};
		}
		const { path, parentShareDBJSProxy } = options;

		super();

		this.uid = ShareDBJSProxy.count++;
		this.debug = new Debug('sharedb-jsproxy:jsproxy['+this.uid+']');

		this.doc = doc;
		this.path = path || [];
		this.parentShareDBJSProxy = parentShareDBJSProxy;

		let data = this.data();
		if(!data) {
			throw new Error("Could not find path", this.path, "in", this.doc.data);
		}

		this.dataType = typeof data;

		this.debug("constructor", this.path, this.dataType, data);

		this.childProxies = {};
		this.setChildProxies(data);
		// need to remove proxies when object changes types to primitive

		this.promises = {};
		this.fromShareDBOps = this.fromShareDBOps.bind(this);
		this.doc.on('op', this.fromShareDBOps);

		return new Proxy(data, this);
	}

	setChildProxies(data) {
		this.debug("setChildProxies", data);
		for(let prop in data) {
			this.setChildProxy(prop);
		}
	}

	setChildProxy(prop) {
		// this.debug("setChildProxy in ", this.path, prop);
		let data = this.data();
		if(!data) {
			return;
		}

		data = data[prop];
		let dataType = typeof data;
		if(!data || dataType !== "object") {
			if(this.childProxies[prop]) {
				delete this.childProxies[prop];
			}
			return;
		}
		let childPath = this.path.slice();
		childPath.push(prop);
		this.debug("setChildProxy", childPath, data, this.doc.data);
		try {
			this.childProxies[prop] = new ShareDBJSProxy(this.doc, { path: childPath, parentShareDBJSProxy: this });
		} catch(e) {
			this.debug("Failed to create a child proxy for", childPath, dataType, data, this.doc.data, e);
			throw e;
		}
	}

	defineProperty(target, prop, descriptor) {
		this.debug("Proxy.defineProperty", this.path, target, prop, descriptor);
	}

	deleteProperty(target, prop) {
		let p = this.path.slice();
		p.push(prop);

		let op = {
			p,
			od: this.data()[prop]
		};

		return this.toShareDBOp(this, prop, undefined, op);
	}

	getOwnPropertyDescriptor(target, prop) {
		let result = Object.getOwnPropertyDescriptor(this.data(), prop);
		this.debug("Proxy.getOwnPropertyDescriptor", this.path, prop, result);
		return result;
	}

	has(target, prop) {
		let result = target[prop];
		this.debug("Proxy.has", this.path, target, prop, result);
		return result;
	}

	ownKeys(target) {
		let result = Reflect.ownKeys(target);
		this.debug("Proxy.ownKeys", this.path, target, result);
		return result;
	}

	parentAt(target, path) {
		let parentPath = path.slice();
		parentPath.pop();
		return this.dataAt(target, path);
	}

	dataAt(target, path) {
		let data = this.doc.data;
		for(let i = 0; i < path.length; i++) {
			if(!data) {
				return null;
			}
			data = data[path[i]];
		}
		return data;
	}

	data(path) {
		return this.dataAt(this.doc.data, path || this.path);
	}

	// eslint-disable-next-line no-unused-vars
	get(target, prop, receiver) {
		if(prop === "__proxy__") {
			this.debug("Proxy.get this", this.path, prop);
			return this;
		}

		this.debug("Proxy.get", this.path, prop);
		let promiseInfo = this.promises[prop];
		if(promiseInfo) {
			this.debug("Proxy.get promiseInfo", promiseInfo);
			return promiseInfo.promise.then(() => {
				let result = this.childProxies[prop] || target[prop];
				if(typeof result !== "undefined") {
					this.debug("Proxy.get async", prop, result);
				}
				return result;
			});
		}

		let result = this.childProxies[prop] || target[prop];
		if(typeof result !== "undefined") {
			this.debug("Proxy.get sync", prop, result);
		}

		return result;
	}

	set(target, prop, data) {
		if(target[prop] === data) {
			this.debug("Proxy.set unchanged", this.path, prop, data);
			const event = { prop, data };
			this.debug("emit", event);
			this.emit("unchanged", event);
			return true;
		}

		this.debug("Proxy.set", this.path, prop, data);
		let setter = this["toShareDB_"+this.dataType];
		if(!setter) {
			throw new Error("Could not find setter for type "+this.dataType);
		}

		return setter.apply(this, [ target, prop, data ]);
	}

	inferType(data) {
		if(!data) {
			return "object";
		}

		let type = typeof data;
		if(type === "object") {
			if(Array.isArray(data)) {
				return "array";
			}
			return type;
		}
		
		return type;
	}

	// eslint-disable-next-line no-unused-vars
	toShareDB_object(target, prop, data, proxy) {
		if(typeof target[prop] === 'string') {
			const promise = this.toShareDB_string(target, prop, data, proxy);
			if(promise) {
				return promise;
			}
		}

		let p = this.path.slice();
		p.push(prop);
		
		let op = {
			p,
			oi: data
		};

		return this.toShareDBOp(target, prop, data, op);
	}

	toShareDBOps(target, prop, data, ops) {
		return Promise.all(ops.map(op => this.toShareDBOp(target, prop, data, op)));
	}

	toShareDBOp(target, prop, data, op) {
		this.debug('Proxy.set toShareDBOp', this.path, prop, data, op);
		let promiseInfo = this.promises[prop] = { prop, data };
		let self = this;
		promiseInfo.promise = ShareDBPromises.submitOp(this.doc, [ op ])
								.then(() => {
									self.setChildProxy(prop);
								});
		return promiseInfo.promise;
	}

	// eslint-disable-next-line no-unused-vars
	toShareDB_array(target, prop, data, proxy) {
		this.debug("toShareDB_array", this.path, prop, data);
	}
	
	// eslint-disable-next-line no-unused-vars
	toShareDB_string(target, prop, data, proxy) {
		this.debug("toShareDB_string", this.path, prop, data);
	}

	async fromShareDBOps(ops, source) {
		// this.debug("fromShareDBOps", this.path, ops, source);
		return await Promise.all(ops.map(op => this.fromShareDBOp(op, source)));
	}

	async fromShareDBOp(op, source) {
		let pathOffset = 1;
		if(op.si || op.sd) {
			pathOffset = 2;
		}

		for(let i = 0; i < op.p.length - pathOffset && i < this.path.length; i++) {
			if(op.path[i] != this.path[i]) {
				this.debug("fromShareDBOp error: path not found", this.path, op, source);
				return;
			}
		}

		if(op.p.length - pathOffset < this.path.length) {
			this.debug("fromShareDBOp error: path too short", this.path, op, source);
			return;
		}

		const prop = op.p[op.p.length - pathOffset];
		const data = this.doc.data[prop];

		const event = { prop, data, source };
		this.debug("fromShareDBOp", event);
		this.emit("change", event);
	}
}

module.exports = ShareDBJSProxy;


