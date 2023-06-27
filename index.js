'use strict';

const Debug				= require('debug');
const EventEmitter		= require('events');

class ShareDbJSProxy extends EventEmitter {

	constructor(doc, options) {
		if(!options) {
			options = {};
		}
		const { path, parentShareDbJSProxy } = options;

		super();

		this.debug = new Debug("ShareDbJSProxy:debug");

		this.doc = doc;
		this.path = path || [];
		this.parentShareDbJSProxy = parentShareDbJSProxy;

		// this.debug("constructor in", this.path);

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
		this.fromShareDbOps = this.fromShareDbOps.bind(this);
		this.doc.on('op', this.fromShareDbOps);

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
			this.childProxies[prop] = new ShareDbJSProxy(this.doc, { path: childPath, parentShareDbJSProxy: this });
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

		return this.toShareDbOp(this, prop, undefined, op);
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

	get(target, prop, receiver) {
		this.debug("Proxy.get", this.path, prop);
		if(prop === "__proxy__") {
			return this;
		}

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
			this.debug("Proxy.set same", this.path, prop, data);
			return;
		}
		this.debug("Proxy.set", this.path, prop, data);
		let setter = this["toShareDb_"+this.dataType];
		if(!setter) {
			throw new Error("Could not find setter for type "+this.dataType);
		}

		const result = setter.apply(this, [ target, prop, data ]);
		this.emit("change", { target, prop, data });
		return result;
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

	toShareDb_object(target, prop, data, proxy) {
		let p = this.path.slice();
		p.push(prop);

		let op = {
			p,
			oi: data
		};

		return this.toShareDbOp(target, prop, data, op);
	}

	async submitOp(doc, op, options) {
		return new Promise((resolve, reject) => {
			doc.submitOp(op, options, (error) => {
				if (error) {
					return reject(error);
				}
				return resolve();
			});
		});
	}

	toShareDbOp(target, prop, data, op) {
		this.debug("Proxy.set toShareDbOp", this.path, prop, data, op);
		let promiseInfo = this.promises[prop] = { prop, data };
		let self = this;
		promiseInfo.promise = this.submitOp(this.doc, [ op ])
								.then(() => {
									self.setChildProxy(prop);
								});
		return promiseInfo.promise;
	}

	toShareDb_array(target, prop, data, proxy) {
		this.debug("toShareDb_array", this.path, prop, data);
	}

	toShareDb_string(target, prop, data, proxy) {
		this.debug("toShareDb_string", this.path, prop, data);
	}

	async fromShareDbOps(ops, isSource, sourceId, sourceOp) {
		if(sourceOp.op.d != this.doc.id) {
			// not my op
			return;
		}

		return await Promise.all(ops.map(op => this.fromShareDbOp(op, isSource, sourceId, sourceOp)));
	}

	async fromShareDbOp(op, isSource, sourceId, sourceOp) {

		let pathOffset = 1;
		if(op.si || op.sd) {
			pathOffset = 2;
		}

		for(let i = 0; i < op.p.length - pathOffset && i < this.path.length; i++) {
			if(op.path[i] != this.path[i]) {
				return;
			}
		}

		if(op.p.length - pathOffset < this.path.length) {
			return;
		}

		const target = this;
		const prop = op.p[op.p.length - pathOffset];
		const data = this.doc.data[prop];

		if(target[prop] == data) {
			return;
		}

		this.debug("fromShareDbOp", this.path, op, isSource, sourceId, sourceOp);

		target[prop] = data;

		this.emit("change", { target, prop, data });
		
	}
}

module.exports = ShareDbJSProxy;


