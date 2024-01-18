class DataObject {
    constructor(obj) {
        try {
            if (obj instanceof Array) {
                obj = obj[0];
            }
            this.id = obj.id;
            this.err = [];
        } catch (e) {
            throw new Error('Error occurs when assigning attributes from the object.');
        }
    }

    isValid() {
        // To enforce the class inheriting this to implement the logic.
        return false;
    }

    setId(id) {
        this.id = id;
    }

    setError(err) {
        this.err.push(err);
    }

    getId() {
        return this.id;
    }

    getError() {
        return this.err;
    }

    getObject() {
        let obj = {};
        Object.keys(this).filter(k => k.toLowerCase() != 'err').forEach(k => {
            obj[k] = this[k];
        });
        return obj;
    }

    getDataKeys() {
        return Object.keys(this).filter(k => k.toLowerCase() != 'err');
    }

    getDataValues() {
        return Object.entries(this).filter(([k, v]) => k.toLowerCase() != 'err').map(([k, v]) => v);
    }
}

module.exports = DataObject;