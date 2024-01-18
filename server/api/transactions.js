const parameters = process.argv;
const express = require('express');
// fake_db.js for simulation using a fake file (not a connectable db)
const db = parameters[2] == 'fakedb' ? require('../fake_db.js') : require('../postgresdb.js');
const envelope = require('../../entity/envelope.js');
const transaction = require('../../entity/transaction.js');
const { responseHandler, promiseLoader, twoPromisesLoader } = require('../middleware/loader.js');
const { checkAuthenticated } = require('./authenticate.js');
const { formatArray } = require('../util.js');
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
        next(new Error('Transaction ID was not found.'))
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
    req.result = db.getDatabaseRecords(req.body.envelopeId, db.selectOneEnvelopeQuery);
    next();
}, promiseLoader, (req, res, next) => {
    const envelopeObj = new envelope(req.result);
    const transactionObj = new transaction({
        date: req.body.date,
        amount: req.body.amount,
        recipient: req.body.recipient,
        envelopeId: req.body.envelopeId
    });
    if (envelopeObj.budget >= transactionObj.amount) {
        envelopeObj.setBudget(envelopeObj.getBudget() - transactionObj.getAmount());
        req.resultOne = db.createUpdateDatabaseRecord(envelopeObj, db.updateEnvelopeQuery, null);
        req.resultTwo = db.createUpdateDatabaseRecord(transactionObj, db.createTransactionQuery, db.selectLastTransactionIdQuery);
        next();
    } else {
        next(new Error('Not enough budget from the envelope to fulfill this transaction.'));
    }
}, twoPromisesLoader, (req, res, next) => {
    if (req.resultOne && req.resultTwo) {
        const envelopeResult = req.resultOne[0];
        const transactionResult = req.resultTwo[0];
        req.result = {
            id: transactionResult.id,
            date: transactionResult.date,
            amount: transactionResult.amount,
            recipient: transactionResult.recipient,
            envelopeId: transactionResult.envelopeId,
            envelopeBudgetAfter: envelopeResult.budget
        };
        req.code_success = 201;
        req.message = [''.concat("New transaction of ID (", transactionResult.id, ") has been created.")];
        req.message.push(''.concat("Updated budget of the \"", envelopeResult.name, "\" envelope is now ", envelopeResult.budget, "."));
        next();
    } else {
        next(new Error('Fail to get the result successfully from the database.'));
    }
}, responseHandler);

transactionRouter.put('/', checkAuthenticated, (req, res, next) => {
    req.session.error_msg = formatArray(req.session.error_msg, []);
    req.session.error_msg.push('Transaction ID is mandatory in update operation.');
    res.redirect(303, '/budget/transactions');
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
        date: req.body.date || originalTransactionObj.getDate(),
        amount: req.body.amount || originalTransactionObj.getAmount(),
        recipient: req.body.recipient || originalTransactionObj.getRecipient(),
        envelopeId: req.body.envelopeId || originalTransactionObj.getEnvelopeId()
    });
    const newAmount = transactionObj.getAmount() || originalTransactionObj.getAmount();
    const diffAmount = newAmount - originalTransactionObj.getAmount();
    if (envelopeObj.budget >= diffAmount) {
        envelopeObj.setBudget(envelopeObj.getBudget() - diffAmount);
        req.resultOne = db.createUpdateDatabaseRecord(envelopeObj, db.updateEnvelopeQuery, null);
        req.resultTwo = db.createUpdateDatabaseRecord(transactionObj, db.updateTransactionQuery, null);
        next();
    } else {
        next(new Error('Not enough budget from the envelope to fulfill this transaction.'));
    }
}, twoPromisesLoader, (req, res, next) => {
    if (req.resultOne && req.resultTwo) {
        const envelopeResult = req.resultOne[0];
        const transactionResult = req.resultTwo[0];
        req.result = {
            id: transactionResult.id,
            date: transactionResult.date,
            amount: transactionResult.amount,
            recipient: transactionResult.recipient,
            envelopeId: transactionResult.envelopeId,
            envelopeBudgetAfter: envelopeResult.budget
        };
        req.code_success = 201;
        req.message = [''.concat("Transaction ID (", transactionResult.id, ") has been updated.")];
        req.message.push(''.concat("Updated budget of the \"", envelopeResult.name, "\" envelope is now ", envelopeResult.budget, "."));
        next();
    } else {
        next(new Error('Fail to get the result successfully from the database.'));
    }
}, responseHandler);

transactionRouter.delete('/', checkAuthenticated, (req, res, next) => {
    req.session.error_msg = formatArray(req.session.error_msg, []);
    req.session.error_msg.push('Transaction ID is mandatory in delete operation.');
    res.redirect(303, '/budget/transactions');
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
        const transactionResult = req.resultOne[0];
        const envelopeResult = req.resultTwo[0];
        req.result = {
            id: transactionResult.id,
            envelopeId: envelopeResult.id,
            envelopeBudgetAfter: envelopeResult.budget
        };
        req.code_success = 201;
        req.message = [''.concat("Transaction ID (", transactionResult.id, ") has been deleted.")];
        req.message.push(''.concat("Budget has been returned to the \"", envelopeResult.name, "\" envelope. Updated budget is now ", envelopeResult.budget, "."));
        next();
    } else {
        next(new Error('Fail to get the result successfully from the database.'));
    }
}, responseHandler);

module.exports = transactionRouter;