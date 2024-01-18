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

const getDatabaseRecords = async (id, sqlFunc) => {
    try {
        if (!connection) {
            await dbConnect();
        }
        const data = await connection.query(sqlFunc(id));
        if (data.rows.length == 1) {
            return [data.rows[0]];
        } else if (data.rows.length > 1) {
            return data.rows;
        }
    } catch (err) {
        console.log('Error: Fail to get records from DB ...');
        throw new Error(err);
    }
}

const createUpdateDatabaseRecord = async (obj, sqlFunc, findIdFunc) => {
    if (!obj || !(obj instanceof dataobject)) {
        throw new Error('Not valid value or data type (Data Object) for creating or updating record in database.');
    }
    if (obj.isValid()) {
        try {
            if (!connection) {
                dbConnect();
            }
            if (!obj.getId() && findIdFunc) {
                const newId = await getDatabaseRecords(null, findIdFunc);
                if (newId && newId.length > 0) {
                    obj.setId(newId[0].id + 1);
                } else {
                    obj.setId(1);
                }
            }
            await connection.query(sqlFunc(obj));
            await connection.query('COMMIT');
            return [obj.getObject()];
        } catch (err) {
            await connection.query('ROLLBACK');
            console.log('Error: Fail to create or update record in DB ... Rollback initiated ...');
            throw new Error(err);
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
        return [data.rows[0]];
    } catch (err) {
        await connection.query('ROLLBACK');
        console.log('Error: Fail to delete records from DB ... Rollback initiated ...');
        throw new Error(err);
    }
}

const constructUpdateQueryById = (obj, table) => {
    let sqlString = 'UPDATE ' + table + ' SET  ';
    let counter = 2;
    Object.entries(obj).forEach(([k, v]) => {
        if (k.toLowerCase() != 'id' && obj.getDataKeys().includes(k) && v) {
            // Column envelopeId has to be double quoted otherwise the captical letter in between won't be preserved!!
            sqlString = sqlString + '"' + k + '" = $' + counter + ', ';
            counter++;
        }
    });
    sqlString = sqlString.replace(/,\s*$/, ' ') + ' WHERE id = $1';
    return sqlString;
};

const selectAllEnvelopesQuery = () => {
    return {
        // name: 'select-all-envelopes',
        text: 'SELECT * FROM app.envelopes ORDER BY id'
    };
};

const selectOneEnvelopeQuery = (id) => {
    return {
        // name: 'select-one-envelope-by-id',
        text: 'SELECT * FROM app.envelopes WHERE id = $1',
        values: [id]
    };
};

const selectLastEnvelopeIdQuery = () => {
    return {
        // name: 'select-last-envelope-id',
        text: 'SELECT id FROM app.envelopes ORDER BY id DESC LIMIT 1',
    };
};

const createEnvelopeQuery = (obj) => {
    return {
        // name: 'create-envelope',
        text: 'INSERT INTO app.envelopes (id, name, budget) VALUES ($1, $2, $3)', 
        values: [obj.getId(), obj.getName(), obj.getBudget()]
    };
};

const updateEnvelopeQuery = (obj) => {
    return {
        // name: 'update-envelope',
        text: constructUpdateQueryById(obj, 'app.envelopes'), 
        values: obj.getDataValues().filter(v => v)
    };
};

const deleteOneEnvelopeQuery = (id) => {
    return {
        // name: 'delete-one-envelope-by-id',
        text: 'DELETE FROM app.envelopes WHERE id = $1 RETURNING id',
        values: [id]
    };
};

const selectAllTransactionsQuery = () => {
    return {
        // name: 'select-all-transactions',
        text: 'SELECT * FROM app.transactions ORDER BY id'
    };
};

const selectOneTransactionQuery = (id) => {
    return {
        // name: 'select-one-transaction-by-id',
        text: 'SELECT * FROM app.transactions WHERE id = $1',
        values: [id]
    };
};

const selectLastTransactionIdQuery = () => {
    return {
        // name: 'select-last-transaction-id',
        text: 'SELECT id FROM app.transactions ORDER BY id DESC LIMIT 1',
    };
};

const createTransactionQuery = (obj) => {
    // Column envelopeId has to be double quoted otherwise the captical letter in between won't be preserved!!
    return {
        // name: 'create-transaction',
        text: 'INSERT INTO app.transactions (id, date, amount, recipient, "envelopeId") VALUES ($1, $2, $3, $4, $5)', 
        values: [obj.getId(), obj.getDate(), obj.getAmount(), obj.getRecipient(), obj.getEnvelopeId()]
    };
};

const updateTransactionQuery = (obj) => {
    return {
        // name: 'update-transaction',
        text: constructUpdateQueryById(obj, 'app.transactions'), 
        values: obj.getDataValues().filter(v => v)
    };
};

const deleteOneTransactionQuery = (id) => {
    return {
        // name: 'delete-one-transaction-by-id',
        text: 'DELETE FROM app.transactions WHERE id = $1 RETURNING id',
        values: [id]
    };
};

const selectOneUserQuery = (email) => {
    return {
        // name: 'select-one-user-by-email',
        text: 'SELECT * FROM app.usersauth WHERE email = $1',
        values: [email]
    };
};

const createUserQuery = (obj) => {
    return {
        // name: 'create-user',
        text: 'INSERT INTO app.usersauth (name, email, hash) VALUES ($1, $2, $3)', 
        values: [obj.getName(), obj.getEmail(), obj.getPasswordHash()]
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