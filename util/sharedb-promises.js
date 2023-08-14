const debug	= require('debug')('sharedb-jsproxy:util:promises');

async function fetch() {
    const [ doc ] = arguments;

    return new Promise((resolve, reject) => {
        debug("Fetching", doc.collection, doc.id);
        doc.fetch((err) => {
            if (err) {
                debug("Failed to fetch", doc.collection, doc.id, err, err.stack);
                return reject(err);
            }
            debug("Fetched", doc.collection, doc.id, doc.data);
            return resolve(doc);
        });
    });
}

async function create() {
    const [ doc, data ] = arguments;

    return new Promise((resolve, reject) => {
        debug("Creating", doc.collection, doc.id);
        doc.create(data, (err) => {
            if (err) {
                debug("Failed to create", doc.collection, doc.id, err, err.stack);
                return reject(err);
            }
            debug("Created", doc.collection, doc.id, doc.data);
            return resolve(doc);
        });
    });
}

module.exports = {
	fetch,
	create
};

