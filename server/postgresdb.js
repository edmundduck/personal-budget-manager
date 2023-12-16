const pg = require('pg');
const fs = require('fs');
const dataobject = require('../entity/dataobject.js');
var connection;

function getConnectionDetail() {
    try {
        const secretfile = fs.readFileSync('.db.secret', 'UTF-8');
        const lines = secretfile.split('\n');
        let found = false;
        let connectionString;
        lines.forEach(line => {
            if (!connectionString) {
                if (line.startsWith('# personal_budget')) {
                    found = true;
                } else if (found) {
                    connectionString = line;
                }
            }
        });
        return connectionString;
    } catch (err) {
        console.log('Fail to retrieve DB secret from secret file ...');
        console.error(err);
    }
}

async function dbConnect() {
    try {
        const connectionString = getConnectionDetail();
        connection = new pg.Client({connectionString, });
        await connection.connect();
        console.log('Connected to DB successfully.');
    } catch (err) {
        console.log('Fail to connect to DB ...');
        console.error(err);
    }
}

const getDatabaseRecords = async (id, sqlFunc) => {
    try {
        if (!connection) {
            dbConnect();
        }
        const data = await connection.query(sqlFunc(id));
        if (data.rows.length == 1) {
            return data.rows[0];
        } else if (data.rows.length > 1) {
            return data.rows;
        }
    } catch (err) {
        console.log('Fail to get records from DB ...');
        console.error(err);
    }
}

const createUpdateDatabaseRecord = async (obj, sqlFunc) => {
    if (!obj || !(obj instanceof dataobject)) {
        throw new Error('Not valid value or data type (Data Object) for creating or updating record in database.');
    }
    if (obj.isValid()) {
        try {
            if (!connection) {
                dbConnect();
            }
            if (!obj.getId()) {
                const newId = await getNewId();
                obj.setId(newId + 1);
            }
            await connection.query(sqlFunc(obj));
            await connection.query('COMMIT');
            return obj.getObject();
        } catch (err) {
            await connection.query('ROLLBACK');
            console.log('Fail to create or update record in DB ... Rollback initiated ...');
            console.error(err);
        }
    } else {
        throw new Error('Validation on the data object fails, database processsing is aborted.');
    }
}

const deleteDatabaseRecord = async (id, sqlFunc) => {
    try {
        if (!connection) {
            dbConnect();
        }
        const data = await connection.query(sqlFunc(id));
        await connection.query('COMMIT');
        return data.rows[0];
    } catch (err) {
        await connection.query('ROLLBACK');
        console.log('Fail to delete records from DB ... Rollback initiated ...');
        console.error(err);
    }
}

const getNewId = async () => {
    try {
        if (!connection) {
            dbConnect();
        }
        const data = await connection.query('SELECT id FROM app.envelopes ORDER BY id DESC LIMIT 1');
        if (data.rows) {
            return data.rows[0].id;
        } else {
            return 0;
        }
    } catch (err) {
        console.log('Fail to get ID from DB ...');
        console.error(err);
    }
}

const selectAllEnvelopesQuery = () => {
    return {
        name: 'select-all-envelopes',
        text: 'SELECT * FROM app.envelopes ORDER BY id'
    };
};

const selectOneEnvelopeQuery = (id) => {
    return {
        name: 'select-one-envelope-by-id',
        text: 'SELECT * FROM app.envelopes WHERE id = $1 ORDER BY id',
        values: [id]
    };
};

const createEnvelopeQuery = (obj) => {
    return {
        name: 'create-envelope',
        text: 'INSERT INTO app.envelopes (id, name, budget) VALUES ($1, $2, $3)', 
        values: [obj.getId(), obj.getName(), obj.getBudget()]
    };
};

const updateEnvelopeQuery = (obj) => {
    return {
        name: 'update-envelope',
        text: 'UPDATE app.envelopes SET name = $2, budget = $3 WHERE id = $1', 
        values: [obj.getId(), obj.getName(), obj.getBudget()]
    };
};

const deleteOneEnvelopeQuery = (id) => {
    return {
        name: 'delete-one-envelope-by-id',
        text: 'DELETE FROM app.envelopes WHERE id = $1 RETURNING id',
        values: [id]
    };
};

const selectAllTransactionsQuery = () => {
    return {
        name: 'select-all-transactions',
        text: 'SELECT * FROM app.transactions ORDER BY id'
    };
};

const selectOneTransactionQuery = (id) => {
    return {
        name: 'select-one-transaction-by-id',
        text: 'SELECT * FROM app.transactions WHERE id = $1 ORDER BY id',
        values: [id]
    };
};

const createTransactionQuery = (obj) => {
    return {
        name: 'create-transaction',
        text: 'INSERT INTO app.transactions (id, name, budget) VALUES ($1, $2, $3)', 
        values: [obj.getId(), obj.getName(), obj.getBudget()]
    };
};

const updateTransactionQuery = (obj) => {
    return {
        name: 'update-transaction',
        text: 'UPDATE app.transactions SET name = $2, budget = $3 WHERE id = $1', 
        values: [obj.getId(), obj.getName(), obj.getBudget()]
    };
};

const deleteOneTransactionQuery = (id) => {
    return {
        name: 'delete-one-transaction-by-id',
        text: 'DELETE FROM app.transactions WHERE id = $1 RETURNING id',
        values: [id]
    };
};

module.exports = { 
    getDatabaseRecords, 
    createUpdateDatabaseRecord, 
    deleteDatabaseRecord,
    selectAllEnvelopesQuery, 
    selectOneEnvelopeQuery, 
    createEnvelopeQuery, 
    updateEnvelopeQuery, 
    deleteOneEnvelopeQuery
};