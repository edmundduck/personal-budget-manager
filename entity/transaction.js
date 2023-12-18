const dataobject = require('./dataobject.js');

class Transaction extends dataobject {
    constructor(obj) {
        super(obj);
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
                throw new Error('Id should be in numeric value.', { cause: 'id' });
            }
        }
        if (this.date) {
            if (isNaN(Date.parse(this.date))) {
                throw new Error('Date format is not valid.', { cause: 'date' });
            }
        }
        if (!isNaN(parseFloat(this.amount))) {
            this.amount = Number(this.amount);
        } else {
            throw new Error('Amount should be in numeric value.', { cause: 'amount' });
        }
        if (this.amount < 0) {
            throw new Error('Amount should be either zero or positive.', { cause: 'amount' });
        }
        if (this.recipient) {
            if (typeof(this.recipient) != "string") {
                throw new Error('Recipient should be in string.', { cause: 'recipient' });
            }
        }
        if (this.envelopeId) {
            if (!isNaN(parseInt(this.envelopeId))) {
                this.envelopeId = Number(this.envelopeId);
            } else {
                throw new Error('Envelope Id should be in numeric value.', { cause: 'envelopeId' });
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