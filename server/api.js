const parameters = process.argv;
const express = require('express');
let db;
if (parameters[2] == 'fakedb') {
    // fake_db.js for simulation using a fake file (not a connectable db)
    db = require('./fake_db.js');
} else {
    db = require('./postgresdb.js');
}
const envelope = require('../entity/envelope.js');
const transaction = require('../entity/transaction.js');
const baseRouter = express.Router();
const envelopeRouter = express.Router();
const transactionRouter = express.Router();

baseRouter.use('/envelopes', envelopeRouter);
baseRouter.use('/transactions', transactionRouter);

const responseHandler = (req, res, next) => {
    const result = req.result;
    if (result instanceof Promise) {
        result.then((resolve, reject) => {
            if (reject) {
                res.status(500).send('Error database processing. The change may not have been effective in the database.');
            } else {
                res.status(req.code_success).send(resolve);
            }
        }).catch((error) => {
            res.status(500).send(error.message);
        });
    } else if (result) {
        res.status(200).send(result);
    } else {
        res.status(404).send('No result was returned.');
    }
}

const promiseLoader = async (req, res, next) => {
    const result = req.result;
    await result.then((res) => {
        req.result = res;
    });
    next();
}

const twoPromisesLoader = async (req, res, next) => {
    const resultOne = req.resultOne;
    const resultTwo = req.resultTwo;
    await Promise.all([resultOne, resultTwo]).then((res) => {
        req.resultOne = res[0];
        req.resultTwo = res[1];
    });
    next();
}

// Envelope API
envelopeRouter.use('/:envelopeId', (req, res, next) => {
    const id = req.params.envelopeId;
    if (id) {
        try {
            req.envelopeId = parseInt(id);
            next();
        } catch (err) {
            res.status(400).send(err.message);
        }
    } else {
        res.status(404).send('Envelope ID was not found.');
    }
});

envelopeRouter.use('/transfer/:from/:to', (req, res, next) => {
    const fromId = req.params.from;
    const toId = req.params.to;
    const budget = req.query.budget;
    if (fromId && toId && budget) {
        try {
            req.fromId = parseInt(fromId);
            req.toId = parseInt(toId);
            req.budget = parseFloat(budget);
            next();
        } catch (err) {
            res.status(500).send(err.message);
        }
    } else {
        res.status(400).send('Not all mandatory parameters are included in the transfer request.');
    }
});

envelopeRouter.get('/', (req, res, next) => {
    req.result = db.getDatabaseRecords(null, db.selectAllEnvelopesQuery);
    req.code_success = 200;
    next();
}, responseHandler);

envelopeRouter.get('/:envelopeId', (req, res, next) => {
    req.result = db.getDatabaseRecords(req.envelopeId, db.selectOneEnvelopeQuery);
    req.code_success = 200;
    next();
}, responseHandler);

envelopeRouter.post('/', (req, res, next) => {
    const envelopeObj = new envelope ({
        name: req.query.name,
        budget: req.query.budget
    });
    req.result = db.createUpdateDatabaseRecord(envelopeObj, db.createEnvelopeQuery, db.selectLastEnvelopeIdQuery);
    req.code_success = 201;
    next();
}, responseHandler);

envelopeRouter.post('/transfer/:from/:to', (req, res, next) => {
    req.resultOne = db.getDatabaseRecords(req.fromId, db.selectOneEnvelopeQuery);
    req.resultTwo = db.getDatabaseRecords(req.toId, db.selectOneEnvelopeQuery);
    next();
}, twoPromisesLoader, (req, res, next) => {
    const fromEnvelope = new envelope(req.resultOne);
    const toEnvelope = new envelope(req.resultTwo);
    fromEnvelope.budget = parseFloat(fromEnvelope.budget) - parseFloat(req.budget);
    toEnvelope.budget = parseFloat(toEnvelope.budget) + parseFloat(req.budget);
    req.resultOne = db.createUpdateDatabaseRecord(fromEnvelope, db.updateEnvelopeQuery, null);
    req.resultTwo = db.createUpdateDatabaseRecord(toEnvelope, db.updateEnvelopeQuery, null);
    next();
}, twoPromisesLoader, (req, res, next) => {
    if (req.resultOne && req.resultTwo) {
        const fromResult = req.resultOne;
        const toResult = req.resultTwo;
        req.result = {
            sourceId: fromResult.id,
            targetId: toResult.id,
            sourceBudgetAfter: fromResult.budget,
            targetBudgetAfter: toResult.budget
        }
        req.code_success = 201;
        next();
    } else {
        res.status(500).send('Fail to get the transfer result successfully from the database.');
    }
}, responseHandler);

envelopeRouter.put('/:envelopeId', (req, res, next) => {
    const envelopeObj = new envelope({
        id: req.envelopeId,
        name: req.query.name,
        budget: req.query.budget
    });
    req.result = db.createUpdateDatabaseRecord(envelopeObj, db.updateEnvelopeQuery, null);
    req.code_success = 201;
    next();
}, responseHandler);

envelopeRouter.delete('/:envelopeId', (req, res, next) => {
    req.result = db.deleteDatabaseRecord(req.envelopeId, db.deleteOneEnvelopeQuery);
    req.code_success = 201;
    next();
}, responseHandler);


// Transaction API
transactionRouter.use('/:transactionId', (req, res, next) => {
    const id = req.params.transactionId;
    if (id) {
        try {
            req.transactionId = parseInt(id);
            next();
        } catch (err) {
            res.status(400).send(err.message);
        }
    } else {
        res.status(404).send('Transaction ID was not found.');
    }
});

transactionRouter.get('/', (req, res, next) => {
    req.result = db.getDatabaseRecords(null, db.selectAllTransactionsQuery);
    req.code_success = 200;
    next();
}, responseHandler);

transactionRouter.get('/:transactionId', (req, res, next) => {
    req.result = db.getDatabaseRecords(req.transactionId, db.selectOneTransactionQuery);
    req.code_success = 200;
    next();
}, responseHandler);

transactionRouter.post('/', (req, res, next) => {
    // Check if the envelope balance is larger than the transaction amount
    req.result = db.getDatabaseRecords(req.query.envelopeId, db.selectOneEnvelopeQuery);
    next();
}, promiseLoader, (req, res, next) => {
    const envelopeObj = new envelope(req.result);
    const transactionObj = new transaction({
        date: req.query.date,
        amount: req.query.amount,
        recipient: req.query.recipient,
        envelopeId: req.query.envelopeId
    });
    if (envelopeObj.budget >= transactionObj.amount) {
        envelopeObj.setBudget(envelopeObj.getBudget() - transactionObj.getAmount());
        req.resultOne = db.createUpdateDatabaseRecord(envelopeObj, db.updateEnvelopeQuery, null);
        req.resultTwo = db.createUpdateDatabaseRecord(transactionObj, db.createTransactionQuery, db.selectLastTransactionIdQuery);
        next();
    } else {
        res.status(501).send('Not enough budget from the envelope to fulfill this transaction.');
    }
}, twoPromisesLoader, (req, res, next) => {
    if (req.resultOne && req.resultTwo) {
        const envelopeResult = req.resultOne;
        const transactionResult = req.resultTwo;
        req.result = {
            id: transactionResult.id,
            date: transactionResult.date,
            amount: transactionResult.amount,
            recipient: transactionResult.recipient,
            envelopeId: envelopeResult.id,
            envelopeBudgetAfter: envelopeResult.budget,
        }
        req.code_success = 201;
        next();
    } else {
        res.status(500).send('Fail to get the result successfully from the database.');
    }
}, responseHandler);

transactionRouter.put('/:transactionId', (req, res, next) => {
    req.result = db.getDatabaseRecords(req.transactionId, db.selectOneTransactionQuery);
    next();
}, promiseLoader, (req, res, next) => {
    const transactionObj = new transaction(req.result);
    req.resultTwo = req.result;
    req.resultOne = db.getDatabaseRecords(transactionObj.getEnvelopeId(), db.selectOneEnvelopeQuery);
    next();
}, twoPromisesLoader, (req, res, next) => {
    const envelopeObj = new envelope(req.resultOne);
    const originalTransactionObj = new transaction(req.resultTwo);
    const transactionObj = new transaction({
        id: req.transactionId, 
        date: req.query.date,
        amount: req.query.amount,
        recipient: req.query.recipient,
        envelopeId: req.query.envelopeId
    });
    const diffAmount = transactionObj.getAmount() - originalTransactionObj.getAmount();
    if (envelopeObj.budget >= diffAmount) {
        envelopeObj.setBudget(envelopeObj.getBudget() - diffAmount);
        req.resultOne = db.createUpdateDatabaseRecord(envelopeObj, db.updateEnvelopeQuery, null);
        req.resultTwo = db.createUpdateDatabaseRecord(transactionObj, db.updateTransactionQuery, null);
        next();
    } else {
        res.status(501).send('Not enough budget from the envelope to fulfill this transaction.');
    }
}, twoPromisesLoader, (req, res, next) => {
    if (req.resultOne && req.resultTwo) {
        const envelopeResult = req.resultOne;
        const transactionResult = req.resultTwo;
        req.result = {
            id: transactionResult.id,
            date: transactionResult.date,
            amount: transactionResult.amount,
            recipient: transactionResult.recipient,
            envelopeId: envelopeResult.id,
            envelopeBudgetAfter: envelopeResult.budget
        }
        req.code_success = 201;
        next();
    } else {
        res.status(500).send('Fail to get the result successfully from the database.');
    }
}, responseHandler);

transactionRouter.delete('/:transactionId', (req, res, next) => {
    req.result = db.getDatabaseRecords(req.transactionId, db.selectOneTransactionQuery);
    next();
}, promiseLoader, (req, res, next) => {
    const transactionObj = new transaction(req.result);
    req.resultOne = req.result;
    req.resultTwo = db.getDatabaseRecords(transactionObj.getEnvelopeId(), db.selectOneEnvelopeQuery);
    next();
}, twoPromisesLoader, (req, res, next) => {
    const transactionObj = new transaction(req.resultOne);
    const envelopeObj = new envelope(req.resultTwo);
    envelopeObj.setBudget(envelopeObj.getBudget() + transactionObj.getAmount());
    req.resultOne = db.deleteDatabaseRecord(req.transactionId, db.deleteOneTransactionQuery);
    req.resultTwo = db.createUpdateDatabaseRecord(envelopeObj, db.updateEnvelopeQuery, null);
    next();
}, twoPromisesLoader, (req, res, next) => {
    if (req.resultOne && req.resultTwo) {
        const transactionResult = req.resultOne;
        const envelopeResult = req.resultTwo;
        req.result = {
            id: transactionResult.id,
            envelopeId: envelopeResult.id,
            envelopeBudgetAfter: envelopeResult.budget
        }
        req.code_success = 201;
        next();
    } else {
        res.status(500).send('Fail to get the result successfully from the database.');
    }
}, responseHandler);

module.exports = baseRouter;