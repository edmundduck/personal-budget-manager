const dataobject = require('./dataobject.js');

class User extends dataobject {
    constructor(obj) {
        super(obj);
        this.name = obj.name;
        this.email = obj.email;
        this.hash = obj.hash;
    }

    isValid() {
        const re = /.*@.*/;
        if (this.name) {
            if (typeof(this.name) != "string") {
                this.setError(new Error('Name should be in string.', { cause: 'name' }));
                return false;
            }
        }
        if (this.email) {
            if (!this.email.match(re)) {
                this.setError(new Error('It is not a valid email address.', { cause: 'email' }));
                return false;
            }
        } else  {
            this.setError(new Error('Email address is mandatory.', { cause: 'email' }));
            return false;
        }
        return true;
    }

    setName(name) {
        this.name = name;
    }

    setEmail(email) {
        this.email = email;
    }

    setPasswordHash(hash) {
        this.hash = hash;
    }

    getName() {
        return this.name;
    }
    
    getEmail() {
        return this.email;
    }

    getPasswordHash() {
        return this.hash;
    }
}

module.exports = User;