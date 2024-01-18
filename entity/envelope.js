const dataobject = require('./dataobject.js');

class Envelope extends dataobject {
    constructor(obj) {
        super(obj);
        if (obj instanceof Array) {
            obj = obj[0];
        }
        this.name = obj.name;
        this.budget = obj.budget;
    }

    isValid() {
        if (this.id) {
            if (!isNaN(parseInt(this.id))) {
                this.id = Number(this.id);
            } else {
                this.setError(new Error('Id should be in numeric value.', { cause: 'id' }));
                return false;
            }
        }
        if (this.name) {
            if (typeof(this.name) != "string") {
                this.setError(new Error('Name should be in string.', { cause: 'name' }));
                return false;
            }
        }
        if (!isNaN(parseFloat(this.budget))) {
            this.budget = Number(this.budget);
        } else {
            this.setError(new Error('Budget should be in numeric value.', { cause: 'budget' }));
            return false;
        }
        if (this.budget < 0) {
            this.setError(new Error('Budget should be either zero or positive.', { cause: 'budget' }));
            return false;
        }
        return true;
    }

    setName(name) {
        this.name = name;
    }

    setBudget(budget) {
        this.budget = budget;
    }

    getName() {
        return this.name;
    }

    getBudget() {
        return this.budget;
    }
}

module.exports = Envelope;