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
        console.log('Error: Fail to retrieve DB secret from secret file ...');
        throw new Error(err);
    }
}

async function dbConnect() {
    try {
        const connectionString = getConnectionDetail();
        connection = new pg.Client({connectionString, });
        await connection.connect();
        console.log('Connected to DB successfully.');
    } catch (err) {
        console.log('Error: Fail to connect to DB ...');
        throw new Error(err);
    }
}

const getDatabaseRecords = async (input, sqlFunc) => {
    try {
        if (!connection) await dbConnect();
        const data = await connection.query(sqlFunc(input));
        if (data.rows.length == 1) {
            return [data.rows[0]];
        } else if (data.rows.length > 1) {
            return data.rows;
        }
        return null;
    } catch (err) {
        console.log('Error: Fail to get records from DB ...');
        throw new Error(err);
    }
}

const createUpdateDatabaseRecord = async (input, sqlFunc, findIdFunc) => {
    const obj = input.obj;
    if (!obj || !(obj instanceof dataobject)) throw new Error('Error: Not valid value or data type (Data Object) for creating or updating record in database.');
    if (obj.isValid()) {
        try {
            if (!connection) await dbConnect();
            if (!obj.getId() && findIdFunc) {
                const newId = await getDatabaseRecords(input, findIdFunc);
                if (newId && newId.length > 0) {
                    obj.setId(newId[0].id + 1);
                } else {
                    obj.setId(1);
                }
            }
            const data = await connection.query(sqlFunc(input));
            await connection.query('COMMIT');
            // return [obj.getObject()]
            return data.rows[0] ? [data.rows[0]] : null;
        } catch (err) {
            await connection.query('ROLLBACK');
            console.log('Error: Fail to create or update record in DB ... Rollback initiated ...');
            throw new Error(err);
        }
    } else {
        throw new Error('Error: Generic data validation failure, data processsing is aborted.');
    }
}

const deleteDatabaseRecord = async (input, sqlFunc) => {
    try {
        if (!connection) await dbConnect();
        const data = await connection.query(sqlFunc(input));
        await connection.query('COMMIT');
        return data.rows[0] ? [data.rows[0]] : null;
    } catch (err) {
        await connection.query('ROLLBACK');
        console.log('Error: Fail to delete records from DB ... Rollback initiated ...');
        throw new Error(err);
    }
}

const constructUpdateQueryById = (input, table) => {
    const obj = input.obj;
    let sqlString = 'UPDATE ' + table + ' SET  ';
    let returnString = 'id';
    let counter = 3;
    Object.entries(obj).forEach(([k, v]) => {
        if (k.toLowerCase() != 'id' && obj.getDataKeys().includes(k) && v) {
            // Column envelopeId has to be double quoted otherwise the captical letter in between won't be preserved!!
            sqlString = sqlString + '"' + k + '" = $' + counter + ', ';
            returnString = returnString + ', "' + k + '"'; 
            counter++;
        }
    });
    sqlString = sqlString.replace(/,\s*$/, ' ') + ' WHERE userid = $1 AND id = $2 RETURNING ' + returnString;
    return sqlString;
};

const selectAllEnvelopesQuery = (input) => {
    if (! (input instanceof Object)) return null;
    return {
        // name: 'select-all-envelopes',
        text: 'SELECT * FROM app.envelopes WHERE userid = $1 ORDER BY id',
        values: [input.user.id]
    };
};

const selectOneEnvelopeQuery = (input) => {
    if (! (input instanceof Object)) return null;
    return {
        // name: 'select-one-envelope-by-id',
        text: 'SELECT * FROM app.envelopes WHERE userid = $1 AND id = $2',
        values: [input.user.id, input.id]
    };
};

const selectLastEnvelopeIdQuery = (input) => {
    if (! (input instanceof Object)) return null;
    return {
        // name: 'select-last-envelope-id',
        text: 'SELECT id FROM app.envelopes WHERE userid = $1 ORDER BY id DESC LIMIT 1',
        values: [input.user.id]
    };
};

const createEnvelopeQuery = (input) => {
    if (! (input instanceof Object)) return null;
    return {
        // name: 'create-envelope',
        text: 'INSERT INTO app.envelopes (userid, id, name, budget) VALUES ($1, $2, $3, $4) RETURNING id, name, budget',
        values: [input.user.id, input.obj.getId(), input.obj.getName(), input.obj.getBudget()]
    };
};

const updateEnvelopeQuery = (input) => {
    if (! (input instanceof Object)) return null;
    return {
        // name: 'update-envelope',
        text: constructUpdateQueryById(input, 'app.envelopes'), 
        values: [input.user.id].concat(input.obj.getDataValues().filter(v => v))
    };
};

const deleteOneEnvelopeQuery = (input) => {
    if (! (input instanceof Object)) return null;
    return {
        // name: 'delete-one-envelope-by-id',
        text: 'DELETE FROM app.envelopes WHERE userid = $1 AND id = $2 RETURNING id',
        values: [input.user.id, input.id]
    };
};

const selectAllTransactionsQuery = (input) => {
    if (! (input instanceof Object)) return null;
    return {
        // name: 'select-all-transactions',
        text: 'SELECT * FROM app.transactions WHERE userid = $1 ORDER BY id',
        values: [input.user.id]
    };
};

const selectOneTransactionQuery = (input) => {
    if (! (input instanceof Object)) return null;
    return {
        // name: 'select-one-transaction-by-id',
        text: 'SELECT * FROM app.transactions WHERE userid = $1 AND id = $2',
        values: [input.user.id, input.id]
    };
};

const selectLastTransactionIdQuery = (input) => {
    if (! (input instanceof Object)) return null;
    return {
        // name: 'select-last-transaction-id',
        text: 'SELECT id FROM app.transactions WHERE userid = $1 ORDER BY id DESC LIMIT 1',
        values: [input.user.id]
    };
};

const createTransactionQuery = (input) => {
    if (! (input instanceof Object)) return null;
    // Column envelopeId has to be double quoted otherwise the captical letter in between won't be preserved!!
    return {
        // name: 'create-transaction',
        text: 'INSERT INTO app.transactions (userid, id, date, amount, recipient, "envelopeId") VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, date, amount, recipient, "envelopeId"',
        values: [input.user.id, input.obj.getId(), input.obj.getDate(), input.obj.getAmount(), input.obj.getRecipient(), input.obj.getEnvelopeId()]
    };
};

// TODO
const updateTransactionQuery = (input) => {
    if (! (input instanceof Object)) return null;
    return {
        // name: 'update-transaction',
        text: constructUpdateQueryById(input, 'app.transactions'), 
        values: [input.user.id].concat(input.obj.getDataValues().filter(v => v))
    };
};

const deleteOneTransactionQuery = (input) => {
    if (! (input instanceof Object)) return null;
    return {
        // name: 'delete-one-transaction-by-id',
        text: 'DELETE FROM app.transactions WHERE userid = $1 AND id = $2 RETURNING id',
        values: [input.user.id, input.id]
    };
};

const selectOneUserQuery = (input) => {
    if (! (input instanceof Object)) return null;
    return {
        // name: 'select-one-user-by-email',
        text: 'SELECT * FROM app.usersauth WHERE email = $1',
        values: [input.email]
    };
};

const createUserQuery = (input) => {
    if (! (input instanceof Object)) return null;
    return {
        // name: 'create-user',
        text: 'INSERT INTO app.usersauth (name, email, hash) VALUES ($1, $2, $3) RETURNING email',
        values: [input.obj.getName(), input.obj.getEmail(), input.obj.getPasswordHash()]
    };
};

module.exports = { 
    getDatabaseRecords, 
    createUpdateDatabaseRecord, 
    deleteDatabaseRecord,
    selectAllEnvelopesQuery, 
    selectOneEnvelopeQuery, 
    selectLastEnvelopeIdQuery,
    createEnvelopeQuery, 
    updateEnvelopeQuery, 
    deleteOneEnvelopeQuery,
    selectAllTransactionsQuery,
    selectOneTransactionQuery,
    selectLastTransactionIdQuery,
    createTransactionQuery,
    updateTransactionQuery,
    deleteOneTransactionQuery,
    selectOneUserQuery,
    createUserQuery
};