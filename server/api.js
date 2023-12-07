const express = require('express');
const db = require('./fake_db.js');
const baseRouter = express.Router();
const envelopeRouter = express.Router();

baseRouter.use('/envelopes', envelopeRouter);

envelopeRouter.use('/:envelopeId', (req, res, next) => {
    const id = req.params.envelopeId;
    if (id) {
        try {
            req.envelopeId = parseInt(id);
            next();
        } catch (e) {
            res.status(400).send();
        }
    } else {
        res.status(404).send();
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
        } catch (e) {
            res.status(400).send();
        }
    } else {
        res.status(404).send();
    }
});

envelopeRouter.get('/', (req, res, next) => {
    res.send(db.getAllRecordsFromDatabase());
});

envelopeRouter.get('/:envelopeId', (req, res, next) => {
    res.send(db.getOneRecordFromDatabase(req.envelopeId));
});

envelopeRouter.post('/', (req, res, next) => {
    const envelopeObj = {
        name: req.query.name,
        budget: req.query.budget
    }
    const result = db.createNewDatabaseRecord(envelopeObj);
    if (result) {
        res.status(201).send(result);
    } else {
        res.status(500).send();
    }
});

envelopeRouter.post('/transfer/:from/:to', (req, res, next) => {
    fromEnvelope = db.getOneRecordFromDatabase(req.fromId);
    toEnvelope = db.getOneRecordFromDatabase(req.toId);
    const originalFromEnvelopeBudget = fromEnvelope.budget;
    const originalToEnvelopeBudget = toEnvelope.budget;
    fromEnvelope.budget = originalFromEnvelopeBudget - req.budget;
    toEnvelope.budget = originalToEnvelopeBudget + req.budget;
    const fromResult = db.updateDatabaseRecordById(fromEnvelope);
    const toResult = db.updateDatabaseRecordById(toEnvelope);
    if (fromResult && toResult) {
        const result = {
            sourceId: fromResult.id,
            targetId: toResult.id,
            sourceBudgetBefore: originalFromEnvelopeBudget,
            targetBudgetBefore: originalToEnvelopeBudget,
            sourceBudgetAfter: fromResult.budget,
            targetBudgetAfter: toResult.budget
        }
        res.status(201).send(result);
    } else {
        res.status(500).send();
    }
});

envelopeRouter.put('/:envelopeId', (req, res, next) => {
    const envelopeObj = {
        id: req.envelopeId,
        name: req.query.name,
        budget: req.query.budget
    }
    const result = db.updateDatabaseRecordById(envelopeObj);
    if (result) {
        res.status(201).send(result);
    } else {
        res.status(500).send();
    }
});

envelopeRouter.delete('/:envelopeId', (req, res, next) => {
    const result = db.deleteDatabaseRecordById(req.envelopeId);
    if (result) {
        res.status(201).send(result);
    } else {
        res.status(500).send();
    }
});

module.exports = baseRouter;