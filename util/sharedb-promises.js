const debug	= require('debug')('sharedb-jsproxy:util:promises');

async function fetch() {
	const [ doc ] = arguments;

	return new Promise((resolve, reject) => {
		debug("fetch >", doc.collection, doc.id);
		doc.fetch((err) => {
			if (err) {
				debug("fetch !", doc.collection, doc.id, err, err.stack);
				return reject(err);
			}
			debug("fetch <", doc.collection, doc.id, doc.data);
			return resolve(doc);
		});
	});
}

async function create() {
	const [ doc, data ] = arguments;

	return new Promise((resolve, reject) => {
		debug("create >", doc.collection, doc.id);
		doc.create(data, (err) => {
			if (err) {
				debug("create !", doc.collection, doc.id, err, err.stack);
				return reject(err);
			}
			debug("create <", doc.collection, doc.id, doc.data);
			return resolve(doc);
		});
	});
}

async function subscribe() {
	const [ doc ] = arguments;

	return new Promise((resolve, reject) => {
		debug("subscribe >", doc.collection, doc.id);
		doc.subscribe((err) => {
			if (err) {
				debug("subscribe !", doc.collection, doc.id, err, err.stack);
				return reject(err);
			}
			debug("subscribe <", doc.collection, doc.id);
			return resolve(doc);
		});
	});
}

async function submitOp() {
	const [ doc, op, options ] = arguments;

	return new Promise((resolve, reject) => {
		debug("submitOp >", doc.collection, doc.id, op, options);
		doc.submitOp(op, options, (err) => {
			if (err) {
				debug("submitOp !", doc.collection, doc.id, op, options, err, err.stack);
				return reject(err);
			}
			debug("submitOp <", doc.collection, doc.id, op, options);
			return resolve(doc);
		});
	});
}

module.exports = {
	fetch,
	create,
	subscribe,
	submitOp
};

