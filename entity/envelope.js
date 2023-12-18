const dataobject = require('./dataobject.js');

class Envelope extends dataobject {
    constructor(obj) {
        super(obj);
        this.name = obj.name;
        this.budget = obj.budget;
    }

    isValid() {
        if (this.id) {
            if (!isNaN(parseInt(this.id))) {
                this.id = Number(this.id);
            } else {
                throw new Error('Id should be in numeric value.', { cause: 'id' });
            }
        }
        if (this.name) {
            if (typeof(this.name) != "string") {
                throw new Error('Name should be in string.', { cause: 'name' });
            }
        }
        if (!isNaN(parseFloat(this.budget))) {
            this.budget = Number(this.budget);
        } else {
            throw new Error('Budget should be in numeric value.', { cause: 'budget' });
        }
        if (this.budget < 0) {
            throw new Error('Budget should be either zero or positive.', { cause: 'budget' });
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