const parameters = process.argv;
const express = require('express');
// fake_db.js for simulation using a fake file (not a connectable db)
const db = parameters[2] == 'fakedb' ? require('../fake_db.js') : require('../postgresdb.js');
const envelope = require('../../entity/envelope.js');
const { responseHandler, twoPromisesLoader } = require('../middleware/loader.js');
const { checkAuthenticated } = require('./authenticate.js');
const { formatArray } = require('../util.js');
const envelopeRouter = express.Router();

// Envelope API
envelopeRouter.use((req, res, next) => {
    req.page = 'envelopes';
    res.locals.session = req.session;
    next();
});

envelopeRouter.use('/transfer/:from/:to', (req, res, next) => {
    const fromId = req.params.from;
    const toId = req.params.to;
    const budget = req.body.budget;
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
        const fromResult = req.resultOne[0];
        const toResult = req.resultTwo[0];
        req.result = [{
            id: fromResult.id,
            name: fromResult.name,
            budget: fromResult.budget,
            from: true,
            result: true
        }, {
            id: toResult.id,
            name: toResult.name,
            budget: toResult.budget,
            to: true,
            result: true
        }];
        req.code_success = 201;
        req.message = [''.concat("Budget transfer from envelope ID (", fromResult.id, ") to envelope ID (", toResult.id, ") has been completed.")];
        next();
    } else {
        next(new Error('Fail to get the transfer result successfully from the database.'));
    }
}, responseHandler);

envelopeRouter.get(['/transfer', '/transfer/*'], checkAuthenticated, (req, res, next) => {
    req.session.error_msg = formatArray(req.session.error_msg, []);
    req.session.error_msg.push('Not all mandatory parameters are included in the transfer request.');
    res.redirect(303, '/budget/envelopes');
}, responseHandler);

envelopeRouter.post('/transfer/*', checkAuthenticated, (req, res, next) => {
    req.session.error_msg = formatArray(req.session.error_msg, []);
    req.session.error_msg.push('Not all mandatory parameters are included in the transfer request.');
    res.redirect(303, '/budget/envelopes');
}, responseHandler);

envelopeRouter.use('/:envelopeId', (req, res, next) => {
    const id = req.params.envelopeId;
    if (id && id > 0) {
        try {
            req.envelopeId = parseInt(id);
            next();
        } catch (err) {
            next(err);
        }
    } else {
        next(new Error('Error: Missing or invalid envelope ID.'));
    }
});

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
    if (!envelopeObj.isValid()) {
        next(envelopeObj.getError());
        return;
    }
    req.result = db.createUpdateDatabaseRecord(envelopeObj, db.createEnvelopeQuery, db.selectLastEnvelopeIdQuery);
    req.code_success = 201;
    req.message = [''.concat("New envelope \"", req.body.name, "\" has been created.")];
    next();
}, responseHandler);

envelopeRouter.put('/', checkAuthenticated, (req, res, next) => {
    req.session.error_msg = formatArray(req.session.error_msg, []);
    req.session.error_msg.push('Envelope ID is mandatory in update operation.');
    res.redirect(303, '/budget/envelopes');
}, responseHandler);

envelopeRouter.put('/:envelopeId', checkAuthenticated, (req, res, next) => {
    const envelopeObj = new envelope({
        id: req.envelopeId,
        name: req.body.name,
        budget: req.body.budget
    });
    if (!envelopeObj.isValid()) {
        next(envelopeObj.getError());
        return;
    }
    req.result = db.createUpdateDatabaseRecord(envelopeObj, db.updateEnvelopeQuery, null);
    req.code_success = 201;
    req.message = [''.concat("Envelope ID (", req.envelopeId, ") has been updated.")];
    next();
}, responseHandler);

envelopeRouter.delete('/', checkAuthenticated, (req, res, next) => {
    req.session.error_msg = formatArray(req.session.error_msg, []);
    req.session.error_msg.push('Envelope ID is mandatory in delete operation.');
    res.redirect(303, '/budget/envelopes');
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