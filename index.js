'use strict';

const Debug				= require('debug');
const EventEmitter		= require('events');
const DiffMatchPatch	= require('diff-match-patch');

const diffEngine		= new DiffMatchPatch.diff_match_patch();

const ShareDBPromises	= require('sharedb-promises');

class ShareDBJSProxy extends EventEmitter {
	static count = 0;

	constructor(doc, options) {
		super();
		this.setMaxListeners(Infinity);
		doc.setMaxListeners(Infinity);

		if(!options) {
			options = { path: [] };
		}

		Object.assign(this, options);

		this.uid = ShareDBJSProxy.count++;

		if(!this.name) {
			this.name = this.path.join('.');
			if(this.name) {
				this.name = ':' + this.name;
			}
			this.name = doc.collection + ':' + doc.id + this.name;
		}

		this.debug = new Debug('sharedb-jsproxy:jsproxy:' + this.name + ':'+ this.uid);

		this.doc = doc;

		const data = this.data();
		if(!data) {
			throw new Error('Could not find path', this.path, 'in', this.doc.data);
		}

		this.dataType = this.inferType(data);

		this.debug('constructor', this.path, this.dataType, data);

		this.childProxies = {};
		this.setChildProxies(data);
		// need to remove proxies when object changes types to primitive

		this.promises = {};
		this.fromShareDBOps = this.fromShareDBOps.bind(this);
		this.doc.on('op', this.fromShareDBOps);

		const proxy = new Proxy(data, this);
		// this.debug('Returning', proxy);
		return proxy;
	}

	setChildProxies(data) {
		// this.debug('setChildProxies', data);
		for(const prop in data) {
			this.setChildProxy(prop);
		}
	}

	setChildProxy(prop) {
		let data = this.data();
		if(!data) {
			return;
		}

		data = data[prop];
		let dataType = this.inferType(data);
		if(!data || ( dataType !== 'object' && dataType !== 'array' ) ) {
			if(this.childProxies[prop]) {
				delete this.childProxies[prop];
			}
			return;
		}
		let childPath = this.path.slice();
		childPath.push(prop);
		this.debug('setChildProxy', childPath, data, this.doc.data);
		try {
			this.childProxies[prop] = new ShareDBJSProxy(this.doc, { path: childPath, parentShareDBJSProxy: this });
		} catch(e) {
			this.debug('Failed to create a child proxy for', childPath, dataType, data, this.doc.data, e);
			throw e;
		}
	}

	defineProperty(target, prop, descriptor) {
		this.debug('Proxy.defineProperty', this.path, target, prop, descriptor);
	}

	deleteProperty(target, prop) {
		let p = this.path.slice();
		p.push(prop);

		let op = {
			p,
			od: this.data()[prop]
		};

		return this.toShareDBOps(this, prop, undefined, [ op ]);
	}

	getOwnPropertyDescriptor(target, prop) {
		let result = Object.getOwnPropertyDescriptor(this.data(), prop);
		this.debug('Proxy.getOwnPropertyDescriptor', this.path, prop, result);
		return result;
	}

	has(target, prop) {
		let result = target[prop];
		this.debug('Proxy.has', this.path, target, prop, result);
		return result;
	}

	ownKeys(target) {
		let result = Reflect.ownKeys(target);
		this.debug('Proxy.ownKeys', this.path, target, result);
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
		//this.debug('data:', path, data);
		return data;
	}

	data(path) {
		return this.dataAt(this.doc.data, path || this.path);
	}

	// eslint-disable-next-line no-unused-vars
	get(target, prop, receiver) {
		if(prop === '__proxy__') {
			this.debug('Proxy.get this', this.path, prop);
			return this;
		}

		this.debug('Proxy.get', this.path, prop);
		let promiseInfo = this.promises[prop];
		if(promiseInfo?.promise instanceof Promise) {
			this.debug('Proxy.get promiseInfo', promiseInfo);
			return promiseInfo.promise.then(() => {
				let result = this.childProxies[prop] || target[prop];
				this.debug('Proxy.get async', prop, result);
				delete this.promises[prop];
				return result;
			});
		}

		let result = this.childProxies[prop] || target[prop];
		if(typeof result !== 'undefined') {
			this.debug('Proxy.get sync', prop, result);
		}

		return result;
	}

	set(target, prop, data) {
		if(target[prop] === data) {
			this.debug('Proxy.set unchanged', this.path, prop, data);
			const path = this.path.slice();
			path.push(prop);

			this.emitUp('unchanged', { path, prop, data });

			return true;
		}

		const targetDataType = this.dataType;
		this.debug('Proxy.set', this.path, prop, targetDataType, data);
		let setter = this['toShareDB_'+targetDataType];
		if(!setter) {
			throw new Error('Could not find setter for type '+targetDataType);
		}

		return setter.apply(this, [ target, prop, data ]);
	}

	inferType(data) {
		if(!data) {
			return 'object';
		}

		let type = typeof data;
		if(type === 'object') {
			if(Array.isArray(data)) {
				return 'array';
			}
			return type;
		}
		
		return type;
	}

	// eslint-disable-next-line no-unused-vars
	toShareDB_object(target, prop, data, proxy) {
		if(typeof target[prop] === 'string' && typeof data === 'string') {
			const promise = this.toShareDB_string(target, prop, data, proxy);
			if(promise) {
				return promise;
			}
		}

		if(Array.isArray(target[prop]) && Array.isArray(data)) {
			const promise = this.toShareDB_array_merge(target, prop, data, proxy);
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

		return this.toShareDBOps(target, prop, data, [ op ]);
	}

	toShareDBOps(target, prop, data, ops) {
		this.debug('Proxy.set toShareDBOps', this.path, prop, data, ops);
		let promiseInfo = this.promises[prop] = { prop, data };
		promiseInfo.promise = ShareDBPromises.doc(this.doc)
			.submitOp(ops)
			.catch(err => this.emitUp('error', { path: this.path, target, prop, data, ops, error: err }));
		return promiseInfo.promise;
	}

	// eslint-disable-next-line no-unused-vars
	toShareDB_array(target, prop, data, proxy) {
		this.debug('toShareDB_array', this.path, target, prop, target[prop], data);
		const ops = [];

		const p = this.path.slice();
		p.push(prop);
		const prev_data = target[prop];
		if(prev_data) {
			const op = {
				p,
				ld: prev_data
			};
			ops.push(op);
		}
		const op = {
			p,
			li: data
		};
		ops.push(op);

		return this.toShareDBOps(target, prop, data, ops);
	}

	toShareDB_array_merge(target, prop, data, proxy) {
		this.debug('toShareDB_array_merge', this.path, target, prop, target[prop], data);

		const array = target[prop] || [];

		let start = 0;
		for(; start < array.length && start < data.length; start++) {
			if(JSON.stringify(array[start]) != JSON.stringify(data[start])) {
				break;
			}
		}

		let end = 0;
		for(; array.length - end > start; end++) {
			
			const diff = JSON.stringify(array[array.length - end - 1]) != JSON.stringify(data[data.length - end - 1])
			if(diff) {
				break;
			}
		}

		const ops = [];
		for(let i = start; i < array.length - end; i++) {
			const p = this.path.slice();
			p.push(prop);
			p.push(i);
		
			const op = {
				p,
				ld: array[i]
			};

			ops.push(op);
		}

		for(let i = start; i < data.length - end; i++) {
			const p = this.path.slice();
			p.push(prop);
			p.push(i);
		
			const op = {
				p,
				li: data[i]
			};

			ops.push(op);
		}

		return this.toShareDBOps(target, prop, data, ops);
	}

	// eslint-disable-next-line no-unused-vars
	toShareDB_string(target, prop, data, proxy) {
		this.debug('toShareDB_string', this.path, prop, data);

		const diffs = diffEngine.diff_main(target[prop], data);

		const ops = [];

		let offset = 0;
		diffs.forEach(diff => {
			diff.push(offset);
			if(diff[0] !== DiffMatchPatch.DIFF_DELETE) {
				offset+=diff[1].length;
			}
		});

		diffs.forEach(diff => {
			const [ diffOp, text, offset ] = diff; 
			switch (diffOp) {
				case DiffMatchPatch.DIFF_INSERT: {
					const p = this.path.slice();
					p.push(prop);
					p.push(offset);

					const op = {
						p,
						si: text
					};
					ops.push(op);
				}
				break;
				case DiffMatchPatch.DIFF_DELETE: {
					const p = this.path.slice();
					p.push(prop);
					p.push(offset);

					const op = {
						p,
						sd: text
					};
					ops.push(op);
				}
				break;
			}
		});

		if(ops.length) {
			return this.toShareDBOps(target, prop, data, ops)
		}
	}

	fromShareDBOps(ops, source) {
		// this.debug('fromShareDBOps', this.path, ops, source);
		return Promise.all(ops.map(op => this.fromShareDBOp(op, source)));
	}

	fromShareDBOp(op, source) {
		let pathOffset = 1;
		if(op.si || op.sd) {
			pathOffset = 2;
		}

		for(let i = 0; i < op.p.length - pathOffset && i < this.path.length; i++) {
			if(op.p[i] != this.path[i]) {
				return;
			}
		}

		if(op.p.length - pathOffset < this.path.length) {
			return;
		}

		this.debug('fromShareDBOp', op, source);
		const prop = op.p[op.p.length - pathOffset];
		const path = op.p.slice();
		if(pathOffset > 1) {
			path.pop(pathOffset - 1);
		}
		const data = this.data(path);

		this.setChildProxy(prop);

		this.emitUp('change', { path, prop, data, op, source });
	}

	emitUp(name, event) {
		this.debug('emitUp', name, event);
		this.emit(name, event);

		if(this.parentShareDBJSProxy) {
			this.parentShareDBJSProxy.emitUp(name, event);
		}
	}
}

module.exports = ShareDBJSProxy;


