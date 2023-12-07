const envelope = require('../entity/envelope.js');

const data = [
    { id: 1, name: 'groceries', budget: 300 },
    { id: 2, name: 'books', budget: 50 }
];

const getAllRecordsFromDatabase = () => {
    return data;
}
const getOneRecordFromDatabase = (id) => {
    return data.find((item) => {
        return item.id === id;
    });
}

const createNewDatabaseRecord = (obj) => {
    if (!obj) {
        return null;
    }
    const envelopeObj = new envelope(obj);
    // Get the ID from the last of the array and add 1, assume the last of the array always has the largest ID
    envelopeObj.setId(data[data.length-1].id + 1);
    if (envelopeObj.isValid()) {
        data.push(envelopeObj.getObject());
        return envelopeObj.getObject();
    } else {
        return null;
    }
}

const updateDatabaseRecordById = (obj) => {
    if (!obj) {
        return null;
    }
    const envelopeObj = new envelope(obj);
    if (envelopeObj.isValid()) {
        const index = data.findIndex((item) => {
            return item.id === envelopeObj.getId();
        });
        data[index] = envelopeObj.getObject();
        return data[index];
    } else {
        return null;
    }
}

const deleteDatabaseRecordById = (id) => {
    const index = data.findIndex((item) => {
        return item.id === id;
    });
    if (index >= 0) {
        return data.splice(index, 1);
    } else {
        return null;
    }
}

module.exports = { getAllRecordsFromDatabase, getOneRecordFromDatabase, createNewDatabaseRecord, updateDatabaseRecordById, deleteDatabaseRecordById };