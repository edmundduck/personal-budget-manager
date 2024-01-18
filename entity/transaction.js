const dataobject = require('./dataobject.js');

class Transaction extends dataobject {
    constructor(obj) {
        super(obj);
        if (obj instanceof Array) {
            obj = obj[0];
        }
        this.date = obj.date;
        this.amount = obj.amount;
        this.recipient = obj.recipient;
        this.envelopeId = obj.envelopeId;
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
        if (this.date) {
            if (isNaN(Date.parse(this.date))) {
                this.setError(new Error('Date format is not valid.', { cause: 'date' }));
                return false;
            }
        }
        if (this.amount) {
            if (!isNaN(parseFloat(this.amount))) {
                this.amount = Number(this.amount);
            } else {
                this.setError(new Error('Amount should be in numeric value.', { cause: 'amount' }));
                return false;
            }
            if (this.amount < 0) {
                this.setError(new Error('Amount should be either zero or positive.', { cause: 'amount' }));
                return false;
            }
        }
        if (this.recipient) {
            if (typeof(this.recipient) != "string") {
                this.setError(new Error('Recipient should be in string.', { cause: 'recipient' }));
                return false;
            }
        }
        if (this.envelopeId) {
            if (!isNaN(parseInt(this.envelopeId))) {
                this.envelopeId = Number(this.envelopeId);
            } else {
                this.setError(new Error('Envelope Id should be in numeric value.', { cause: 'envelopeId' }));
                return false;
            }
        }
        return true;
    }

    setDate(date) {
        this.date = date;
    }

    setAmount(amount) {
        this.amount = amount;
    }

    setRecipient(recipient) {
        this.recipient = recipient;
    }

    setEnvelopeId(envelopeId) {
        this.envelopeId = envelopeId;
    }

    getDate() {
        return this.date;
    }

    getAmount() {
        return this.amount;
    }

    getRecipient() {
        return this.recipient;
    }

    getEnvelopeId() {
        return this.envelopeId;
    }
}

module.exports = Transaction;