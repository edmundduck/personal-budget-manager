class DataObject {
    constructor(obj) {
        try {
            if (obj instanceof Array) {
                obj = obj[0];
            }
            this.id = obj.id;
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

    getId() {
        return this.id;
    }

    getObject() {
        let obj = {
            id: this.id,
        }
        return obj;
    }
}

module.exports = DataObject;