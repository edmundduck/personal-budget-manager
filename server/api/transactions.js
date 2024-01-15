const parameters = process.argv;
const express = require('express');
let db;
if (parameters[2] == 'fakedb') {
    // fake_db.js for simulation using a fake file (not a connectable db)
    db = require('../fake_db.js');
} else {
    db = require('../postgresdb.js');
}
const envelope = require('../../entity/envelope.js');
const transaction = require('../../entity/transaction.js');
const { responseHandler, promiseLoader, twoPromisesLoader } = require('../middleware/loader.js');
const { checkAuthenticated } = require('./authenticate.js');
const transactionRouter = express.Router();

// Transaction API
transactionRouter.use(['/', '/:transactionId]'], (req, res, next) => {
    req.page = 'transactions';
    res.locals.session = req.session;
    next();
});

transactionRouter.use('/:transactionId', checkAuthenticated, (req, res, next) => {
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

transactionRouter.get('/', checkAuthenticated, (req, res, next) => {
    req.result = db.getDatabaseRecords(null, db.selectAllTransactionsQuery);
    req.code_success = 200;
    next();
}, responseHandler);

transactionRouter.get('/:transactionId', checkAuthenticated, (req, res, next) => {
    req.result = db.getDatabaseRecords(req.transactionId, db.selectOneTransactionQuery);
    req.code_success = 200;
    next();
}, responseHandler);

transactionRouter.post('/', checkAuthenticated, (req, res, next) => {
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

transactionRouter.put('/:transactionId', checkAuthenticated, (req, res, next) => {
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

transactionRouter.delete('/:transactionId', checkAuthenticated, (req, res, next) => {
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

module.exports = transactionRouter;