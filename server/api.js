const parameters = process.argv;
const express = require('express');
let db;
if (parameters[2] == 'fakedb') {
    // fake_db.js for simulation using a fake file (not a connectable db)
    db = require('./fake_db.js');
} else {
    db = require('./postgresdb.js');
}
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

const responseHandler = (req, res, next) => {
    const result = req.result;
    if (result instanceof Promise) {
        result.then((resolve, reject) => {
            if (reject) {
                res.status(500).send(reject);
            } else {
                res.status(req.code_success).send(resolve);
            }
        });
    } else if (result) {
        res.status(200).send(result);
    } else {
        res.status(404).send();
    }
}

const twoPromisesLoader = async (req, res, next) => {
    const resultOne = req.resultOne;
    const resultTwo = req.resultTwo;
    if (resultOne instanceof Promise && resultTwo instanceof Promise) {
        await Promise.all([resultOne, resultTwo]).then((res) => {
            req.resultOne = res[0];
            req.resultTwo = res[1];
        });
    }
    next();
}

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
    req.result = db.getAllRecordsFromDatabase();
    req.code_success = 200;
    next();
}, responseHandler);

envelopeRouter.get('/:envelopeId', (req, res, next) => {
    req.result = db.getOneRecordFromDatabase(req.envelopeId);
    req.code_success = 200;
    next();
}, responseHandler);

envelopeRouter.post('/', (req, res, next) => {
    const envelopeObj = {
        name: req.query.name,
        budget: req.query.budget
    }
    req.result = db.createNewDatabaseRecord(envelopeObj);
    req.code_success = 201;
    next();
}, responseHandler);

envelopeRouter.post('/transfer/:from/:to', (req, res, next) => {
    req.resultOne = db.getOneRecordFromDatabase(req.fromId);
    req.resultTwo = db.getOneRecordFromDatabase(req.toId);
    next();
}, twoPromisesLoader, (req, res, next) => {
    const fromEnvelope = req.resultOne;
    const toEnvelope = req.resultTwo;
    fromEnvelope.budget = parseFloat(fromEnvelope.budget) - parseFloat(req.budget);
    toEnvelope.budget = parseFloat(toEnvelope.budget) + parseFloat(req.budget);
    req.resultOne = db.updateDatabaseRecordById(fromEnvelope);
    req.resultTwo = db.updateDatabaseRecordById(toEnvelope);
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
        res.status(500).send();
    }
}, responseHandler);

envelopeRouter.put('/:envelopeId', (req, res, next) => {
    const envelopeObj = {
        id: req.envelopeId,
        name: req.query.name,
        budget: req.query.budget
    }
    req.result = db.updateDatabaseRecordById(envelopeObj);
    req.code_success = 201;
    next();
}, responseHandler);

envelopeRouter.delete('/:envelopeId', (req, res, next) => {
    req.result = db.deleteDatabaseRecordById(req.envelopeId);
    req.code_success = 201;
    next();
}, responseHandler);

module.exports = baseRouter;