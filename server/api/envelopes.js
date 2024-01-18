const parameters = process.argv;
const express = require('express');
// fake_db.js for simulation using a fake file (not a connectable db)
const db = parameters[2] == 'fakedb' ? require('../fake_db.js') : require('../postgresdb.js');
const envelope = require('../../entity/envelope.js');
const { responseHandler, twoPromisesLoader } = require('../middleware/loader.js');
const { checkAuthenticated } = require('./authenticate.js');
const envelopeRouter = express.Router();

// Envelope API
envelopeRouter.use(['/', '/:envelopeId', '/transfer/:from/:to'], (req, res, next) => {
    req.page = 'envelopes';
    res.locals.session = req.session;
    next();
});

envelopeRouter.use('/:envelopeId', (req, res, next) => {
    const id = req.params.envelopeId;
    if (id) {
        try {
            req.envelopeId = parseInt(id);
            next();
        } catch (err) {
            next(err);
        }
    } else {
        next(new Error('Envelope ID was not found.'));
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
            next(err);
        }
    } else {
        next(new Error('Not all mandatory parameters are included in the transfer request.'));
    }
});

// baseRouter.get('/', checkAuthenticated, (req, res, next) => {
//     res.render('main', { error_msg: null });
// });

envelopeRouter.get('/', checkAuthenticated, (req, res, next) => {
    req.result = db.getDatabaseRecords(null, db.selectAllEnvelopesQuery);
    req.code_success = 200;
    next();
}, responseHandler);

envelopeRouter.get('/:envelopeId', checkAuthenticated, (req, res, next) => {
    req.result = db.getDatabaseRecords(req.envelopeId, db.selectOneEnvelopeQuery);
    req.code_success = 200;
    next();
}, responseHandler);

envelopeRouter.post('/', checkAuthenticated, (req, res, next) => {
    const envelopeObj = new envelope ({
        name: req.body.name,
        budget: req.body.budget
    });
    req.result = db.createUpdateDatabaseRecord(envelopeObj, db.createEnvelopeQuery, db.selectLastEnvelopeIdQuery);
    req.code_success = 201;
    req.message = [''.concat("New envelope \"", req.body.name, "\" has been created.")];
    next();
}, responseHandler);

envelopeRouter.post('/transfer/:from/:to', checkAuthenticated, (req, res, next) => {
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
        next(new Error('Fail to get the transfer result successfully from the database.'));
    }
}, responseHandler);

envelopeRouter.put('/:envelopeId', checkAuthenticated, (req, res, next) => {
    const envelopeObj = new envelope({
        id: req.envelopeId,
        name: req.body.name,
        budget: req.body.budget
    });
    req.result = db.createUpdateDatabaseRecord(envelopeObj, db.updateEnvelopeQuery, null);
    req.code_success = 201;
    req.message = [''.concat("Envelope ID (", req.envelopeId, ") has been updated.")];
    next();
}, responseHandler);

envelopeRouter.delete('/:envelopeId', checkAuthenticated, (req, res, next) => {
    req.result = db.deleteDatabaseRecord(req.envelopeId, db.deleteOneEnvelopeQuery);
    req.code_success = 201;
    req.message = [''.concat("Envelope ID (", req.envelopeId, ") has been deleted.")];
    next();
}, responseHandler);

module.exports = {
    envelopeRouter
};