const pg = require('pg');
const fs = require('fs');
const envelope = require('../entity/envelope.js');
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

const getAllRecordsFromDatabase = async () => {
    try {
        if (!connection) {
            dbConnect();
        }
        const data = await connection.query('SELECT * FROM app.envelopes ORDER BY id');
        return data.rows;
    } catch (err) {
        console.log('Fail to get records from DB ...');
        console.error(err);
    }
}

const getOneRecordFromDatabase = async (id) => {
    try {
        if (!connection) {
            dbConnect();
        }
        const data = await connection.query('SELECT * FROM app.envelopes WHERE id = $1 ORDER BY id', [ id ]);
        return data.rows[0];
    } catch (err) {
        console.log('Fail to get records from DB ...');
        console.error(err);
    }
}

const createNewDatabaseRecord = async (obj) => {
    if (!obj) {
        return null;
    }
    const envelopeObj = new envelope(obj);
    if (envelopeObj.isValid()) {
        try {
            if (!connection) {
                dbConnect();
            }
            const newId = await getNewId();
            envelopeObj.setId(newId + 1);
            await connection.query('INSERT INTO app.envelopes (id, name, budget) VALUES ($1, $2, $3)', [ envelopeObj.getId(), envelopeObj.getName(), envelopeObj.getBudget() ]);
            await connection.query('COMMIT');
            return envelopeObj.getObject();
        } catch (err) {
            await connection.query('ROLLBACK');
            console.log('Fail to create record in DB ... Rollback initiated ...');
            console.error(err);
        }
    } else {
        return null;
    }
}

const updateDatabaseRecordById = async (obj) => {
    if (!obj) {
        return null;
    }
    const envelopeObj = new envelope(obj);
    if (envelopeObj.isValid()) {
        try {
            if (!connection) {
                dbConnect();
            }
            await connection.query('UPDATE app.envelopes SET name = $2, budget = $3 WHERE id = $1', [ envelopeObj.getId(), envelopeObj.getName(), envelopeObj.getBudget() ]);
            await connection.query('COMMIT');
            return envelopeObj.getObject();
        } catch (err) {
            await connection.query('ROLLBACK');
            console.log('Fail to update record in DB ... Rollback initiated ...');
            console.error(err);
        }
    } else {
        return null;
    }
}

const deleteDatabaseRecordById = async (id) => {
    try {
        if (!connection) {
            dbConnect();
        }
        const data = await connection.query('DELETE FROM app.envelopes WHERE id = $1 RETURNING id', [ id ]);
        return data.rows;
    } catch (err) {
        console.log('Fail to delete records from DB ...');
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

module.exports = { getAllRecordsFromDatabase, getOneRecordFromDatabase, createNewDatabaseRecord, updateDatabaseRecordById, deleteDatabaseRecordById };