const dataobject = require('./dataobject.js');

class User extends dataobject {
    constructor(obj) {
        super(obj);
        this.name = obj.name;
        this.email = obj.email;
        this.hash = obj.hash;
    }

    isValid() {
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