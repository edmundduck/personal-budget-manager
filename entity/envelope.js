class Envelope {
    constructor(obj) {
        try {
            this.id = obj.id;
            this.name = obj.name;
            this.budget = obj.budget;
        } catch (e) {
            throw new Error('Error occurs when assigning attributes from the object.');
        }
    }

    isValid() {
        if (this.id) {
            if (!isNaN(parseInt(this.id))) {
                this.id = Number(this.id);
            } else {
                throw new Error('Id should be in numeric value.', { cause: 'id' });
            }
        }
        if (typeof(this.name) != "string") {
            throw new Error('Name should be in string.', { cause: 'name' });
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

    setId(id) {
        this.id = id;
    }

    setName(name) {
        this.name = name;
    }

    setBudget(budget) {
        this.budget = budget;
    }

    getId() {
        return this.id;
    }

    getName() {
        return this.name;
    }

    getBudget() {
        return this.budget;
    }

    getObject() {
        let obj = {
            id: this.id,
            name: this.name,
            budget: this.budget
        }
        return obj;
    }
}

module.exports = Envelope;