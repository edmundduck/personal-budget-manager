const fs = require('fs');
const expect = require('chai').expect;
const request = require('supertest');
const { server } = require('../server');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const parameters = process.argv;
// fake_db.js for simulation using a fake file (not a connectable db)
const db = parameters[2] == 'fakedb' ? require('../server/fake_db.js') : require('../server/postgresdb.js');

describe('Unit test', function() {
    let auth = {};
    let secretMap = new Map();

    before('Get test users secret', () => {
        const secretFile = fs.readFileSync('.test.secret', 'UTF-8');
        secretFile.split('\n').forEach(line => {
            parts = line.split(':=');
            if (parts.length == 2) {
                secretMap.set(parts[0], parts[1]);
            }
        });
    });

    function loginUser(auth) {
        // return function(done) {
        return function() {
            return request(server)
                .post('/login')
                .send({
                    username: secretMap.get('success_userid'),
                    password: secretMap.get('success_passwd')
                })
                .expect(302)
                .then((res) => {
                    expect(res.headers).to.have.property('set-cookie');
                    auth.cookie = res.headers['set-cookie'].pop().split(';')[0];
                    return db.getDatabaseRecords({ email: secretMap.get('success_userid') }, db.selectOneUserQuery).then((res) => {
                        auth.user = res[0];
                    });
                })
                .catch((err) => {
                    if (err) throw err;
                });
        }
    };
    
    before('Get login cookie', loginUser(auth));
    
    describe('Generic functionalities', function() {
        describe('Login and logout', function() {
            it('Log in with an invalid user', () => {
                return request(server)
                    .post('/login')
                    .send({
                        username: secretMap.get('fail_userid'),
                        password: secretMap.get('fail_passwd')
                    })
                    .expect(401);
                }
            );
                    
            it('Log in with a valid user but invalid password', () => {
                return request(server)
                    .post('/login')
                    .send({
                        username: secretMap.get('success_userid'),
                        password: secretMap.get('fail_passwd')
                    })
                    .expect(401);
                }
            );
                    
            it('Log in with a valid user', () => {
                return request(server)
                    .post('/login')
                    .send({
                        username: secretMap.get('success_userid'),
                        password: secretMap.get('success_passwd')
                    })
                    .expect(302)
                    .expect((res) => {
                        expect(res.location, '../budget');
                    });
                }
            );
                    
            it('Log out', function() {
                return request(server)
                    .post('/logout')
                    .set('Cookie', auth.cookie)
                    .expect(302)
                    .expect((res) => {
                        expect(res.location, '../login');
                    });
                }
            );
        });

        describe('Register a new user', function() {
            let newUserId;

            it('Register a new user with all properties available', () => {
                const newFullName = "An automated generated user";
                const newEmail = secretMap.get('new_userid');
                const newPassword = secretMap.get('new_passwd');
                return request(server)
                    .post('/login/new-user')
                    .send({
                        fullname: newFullName,
                        username: newEmail,
                        password: newPassword,
                        passwordconfirm: newPassword
                    })
                    .expect(302)
                    .then((res) => {
                        expect(res.location, '/login');
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        expect(res.text).to.match(/.*confirm_msg=Account.*has.*been.*created.*successfully\..*/);
    
                        return db.getDatabaseRecords({ email: newEmail }, db.selectOneUserQuery).then((res) => {
                            // Test the result in DB against the testing data
                            expect(res).is.length(1);
                            expect(res[0].id).to.exist;
                            expect(newFullName).to.equal(res[0].name);
                            expect(newEmail).to.equal(res[0].email);
                            expect(res[0].hash).to.exist;
                            newUserId = res[0].id;
                        });
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
                }
            );

            it('Register a new user with a wrong confirm password', () => {
                const newFullName = "An automated generated user2";
                const newEmail = secretMap.get('new_userid2');
                const newPassword = secretMap.get('new_passwd');
                const wrongPassword = secretMap.get('fail_passwd');
                return request(server)
                    .post('/login/new-user')
                    .send({
                        fullname: newFullName,
                        username: newEmail,
                        password: newPassword,
                        passwordconfirm: wrongPassword
                    })
                    .expect(401)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                        const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                        const message = parsedDom.window.document.querySelector("li.error_msg");
    
                        // Test the result on screen against the testing data
                        expect(message.textContent).to.equal("Password does not match.");
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
                }
            );

            it('Register a new user with an invalid email address (username)', () => {
                const newFullName = "An automated generated user3";
                const newEmail = secretMap.get('new_userid3');
                const newPassword = secretMap.get('new_passwd');
                return request(server)
                    .post('/login/new-user')
                    .send({
                        fullname: newFullName,
                        username: newEmail,
                        password: newPassword,
                        passwordconfirm: newPassword
                    })
                    .expect(500)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                        const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                        const message = parsedDom.window.document.querySelector("li.error_msg");
    
                        // Test the result on screen against the testing data
                        expect(message.textContent).to.equal("Error: It is not a valid email address.");
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
                }
            );

            after('Clean up the new created user', () => {
                db.deleteDatabaseRecord({ id: newUserId }, db.deleteUserQuery);
            })
        });
    });
    
    describe('Envelopes functionalities (/budget/envelopes)', function() {
        let testId = null;
        let testId2 = null;
        
        before('Get login cookie', loginUser(auth));
        
        describe('Retrieve envelope(s)', function() {
            it('Retrieve all envelopes', function() {
                return request(server)
                    .get('/budget/envelopes')
                    .set('Cookie', auth.cookie)
                    .set('Content-Type', 'text/html')
                    .expect(200)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        return db.getDatabaseRecords({ user: auth.user }, db.selectAllEnvelopesQuery).then((res) => {
                            // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                            const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                            const idList = parsedDom.window.document.querySelectorAll("td.result_id");
                            const nameList = parsedDom.window.document.querySelectorAll("td.result_name");
                            const budgetList = parsedDom.window.document.querySelectorAll("td.result_budget");
    
                            for(let i = 0; i < res.length; i++) {
                                expect(parseInt(idList[i].textContent)).to.equal(res[i].id);
                                expect(nameList[i].textContent).to.equal(res[i].name);
                                expect(parseFloat(budgetList[i].textContent)).to.equal(res[i].budget);
                            };
                        });
                    })
                    // .then((res) => {
                    //     expect(res.text).to.not.be.null;
                    //     expect(res.text).to.not.be.undefined;
    
                    //     // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                    //     const parsedDom = new JSDOM(res.text, {contentType: "text/html"});
                    //     const idList = parsedDom.window.document.querySelectorAll("td.result_id");
                    //     const nameList = parsedDom.window.document.querySelectorAll("td.result_name");
                    //     const budgetList = parsedDom.window.document.querySelectorAll("td.result_budget");
    
                    //     for(let i = 0; i < res.length; i++) {
                    //         expect(idList[i]).to.be.same(res[i].id);
                    //         expect(nameList[i]).to.be.same(res[i].name);
                    //         expect(budgetList[i]).to.be.same(res[i].budget);
                    //     };
                    // })
                    .catch((err) => {
                        if (err) throw err;
                    });
            });
    
            it('Retrieve a single envelope', function() {
                const id = 1;
                return request(server)
                    .get('/budget/envelopes/' + id)
                    .set('Cookie', auth.cookie)
                    .set('Content-Type', 'text/html')
                    .expect(200)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        return db.getDatabaseRecords({ user: auth.user, id: id }, db.selectOneEnvelopeQuery).then((res) => {
                            // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                            const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                            const idList = parsedDom.window.document.querySelectorAll("td.result_id");
                            const nameList = parsedDom.window.document.querySelectorAll("td.result_name");
                            const budgetList = parsedDom.window.document.querySelectorAll("td.result_budget");
    
                            expect(res).is.length(1);
                            expect(parseInt(idList[0].textContent)).to.equal(res[0].id);
                            expect(nameList[0].textContent).to.equal(res[0].name);
                            expect(parseFloat(budgetList[0].textContent)).to.equal(res[0].budget);
                        });
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
            });
    
            it('Retrieve a single envelope with invalid envelope ID', function() {
                const id = -1;
                return request(server)
                    .get('/budget/envelopes/' + id)
                    .set('Cookie', auth.cookie)
                    .set('Content-Type', 'text/html')
                    .expect(500)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                        const idList = parsedDom.window.document.querySelectorAll("td.result_id");
                        const nameList = parsedDom.window.document.querySelectorAll("td.result_name");
                        const budgetList = parsedDom.window.document.querySelectorAll("td.result_budget");
                        const message = parsedDom.window.document.querySelector("li.error_msg");
    
                        expect(idList).is.length(0);
                        expect(nameList).is.length(0);
                        expect(budgetList).is.length(0);
                        expect(message.textContent).to.equal("Error: Missing or invalid envelope ID.");
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
            });
        });
    
        describe('Create a new envelope', function() {
            it('Post a new envelope with all properties available', function() {
                const testname = "Test";
                const testbudget = 9.99;
                return request(server)
                    .post('/budget/envelopes')
                    .set('Cookie', auth.cookie)
                    .send({
                        name: testname,
                        budget: testbudget
                    })
                    .expect(201)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                        const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                        const idList = parsedDom.window.document.querySelectorAll("td.result_id");
                        const nameList = parsedDom.window.document.querySelectorAll("td.result_name");
                        const budgetList = parsedDom.window.document.querySelectorAll("td.result_budget");
                        const message = parsedDom.window.document.querySelector("li.confirm_msg");
    
                        // Test the result on screen against the testing data
                        expect(idList).is.length(1);
                        expect(nameList).is.length(1);
                        expect(budgetList).is.length(1);
                        expect(message.textContent).to.equal("New envelope \"" + nameList[0].textContent + "\" has been created.");
                        expect(idList[0].textContent).to.exist;
                        expect(nameList[0].textContent).to.equal(testname);
                        expect(parseFloat(budgetList[0].textContent)).to.equal(testbudget);
    
                        testId = parseInt(idList[0].textContent);
                        return db.getDatabaseRecords({ user: auth.user, id: testId }, db.selectOneEnvelopeQuery).then((res) => {
                            // Test the result in DB against the testing data
                            expect(res).is.length(1);
                            expect(testId).to.equal(res[0].id);
                            expect(testname).to.equal(res[0].name);
                            expect(testbudget).to.equal(res[0].budget);
                        });
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
            });
    
            it('Post a new envelope without name', function() {
                const testname = "";
                const testbudget = 9.99;
                return request(server)
                    .post('/budget/envelopes')
                    .set('Cookie', auth.cookie)
                    .send({
                        name: testname,
                        budget: testbudget
                    })
                    .expect(201)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                        const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                        const idList = parsedDom.window.document.querySelectorAll("td.result_id");
                        const nameList = parsedDom.window.document.querySelectorAll("td.result_name");
                        const budgetList = parsedDom.window.document.querySelectorAll("td.result_budget");
                        const message = parsedDom.window.document.querySelector("li.confirm_msg");
    
                        // Test the result on screen against the testing data
                        expect(idList).is.length(1);
                        expect(nameList).is.length(1);
                        expect(budgetList).is.length(1);
                        expect(message.textContent).to.equal("New envelope \"" + nameList[0].textContent + "\" has been created.");
                        expect(idList[0].textContent).to.exist;
                        expect(nameList[0].textContent).to.be.empty;
                        expect(parseFloat(budgetList[0].textContent)).to.equal(testbudget);
    
                        testId2 = parseInt(idList[0].textContent);
                        return db.getDatabaseRecords({ user: auth.user, id: testId2 }, db.selectOneEnvelopeQuery).then((res) => {
                            // Test the result in DB against the testing data
                            expect(res).is.length(1);
                            expect(testId2).to.equal(res[0].id);
                            expect(res[0].name).to.be.empty;
                            expect(testbudget).to.equal(res[0].budget);
    
                            // Specific remove this unit test record from DB
                            // return db.deleteDatabaseRecord(toBeDeletedId, db.deleteOneEnvelopeQuery);
                        });
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
            });
    
            it('Post a new envelope without budget', function() {
                const testname = "No budget";
                return request(server)
                    .post('/budget/envelopes')
                    .set('Cookie', auth.cookie)
                    .send({
                        name: testname
                    })
                    .expect(500)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                        const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                        const idList = parsedDom.window.document.querySelectorAll("td.result_id");
                        const nameList = parsedDom.window.document.querySelectorAll("td.result_name");
                        const budgetList = parsedDom.window.document.querySelectorAll("td.result_budget");
                        const message = parsedDom.window.document.querySelector("li.error_msg");
    
                        // Test the result on screen against the testing data
                        expect(idList).is.length(0);
                        expect(nameList).is.length(0);
                        expect(budgetList).is.length(0);
                        expect(message.textContent).to.equal("Error: Budget should be in numeric value.");
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
            });
    
            it('Post a new envelope with negative budget', function() {
                const testbudget = -3;
                return request(server)
                    .post('/budget/envelopes')
                    .set('Cookie', auth.cookie)
                    .send({
                        budget: testbudget
                    })
                    .expect(500)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                        const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                        const idList = parsedDom.window.document.querySelectorAll("td.result_id");
                        const nameList = parsedDom.window.document.querySelectorAll("td.result_name");
                        const budgetList = parsedDom.window.document.querySelectorAll("td.result_budget");
                        const message = parsedDom.window.document.querySelector("li.error_msg");
    
                        // Test the result on screen against the testing data
                        expect(idList).is.length(0);
                        expect(nameList).is.length(0);
                        expect(budgetList).is.length(0);
                        expect(message.textContent).to.equal("Error: Budget should be either zero or positive.");
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
            });
    
        });
    
        describe('Update an envelope', function() {
            it('Update an envelope with all properties available', function() {
                const testname = "Test 2";
                const testbudget = 25.28;
                return request(server)
                    .post('/budget/envelopes/' + testId + '?_method=PUT')
                    .set('Cookie', auth.cookie)
                    .send({
                        name: testname,
                        budget: testbudget
                    })
                    .expect(201)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                        const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                        const idList = parsedDom.window.document.querySelectorAll("td.result_id");
                        const nameList = parsedDom.window.document.querySelectorAll("td.result_name");
                        const budgetList = parsedDom.window.document.querySelectorAll("td.result_budget");
                        const message = parsedDom.window.document.querySelector("li.confirm_msg");
    
                        // Test the result on screen against the testing data
                        expect(idList).is.length(1);
                        expect(nameList).is.length(1);
                        expect(budgetList).is.length(1);
                        expect(message.textContent).to.equal("Envelope ID (" + testId + ") has been updated.");
                        expect(parseInt(idList[0].textContent)).to.equal(testId);
                        expect(nameList[0].textContent).to.equal(testname);
                        expect(parseFloat(budgetList[0].textContent)).to.equal(testbudget);
    
                        return db.getDatabaseRecords({ user: auth.user, id: testId }, db.selectOneEnvelopeQuery).then((res) => {
                            // Test the result in DB against the testing data
                            expect(res).is.length(1);
                            expect(testId).to.equal(res[0].id);
                            expect(testname).to.equal(res[0].name);
                            expect(testbudget).to.equal(res[0].budget);
                        });
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
            });
    
            it('Update an envelope with only part of properties available', function() {
                const testbudget = 33.23;
                return request(server)
                    .post('/budget/envelopes/' + testId + '?_method=PUT')
                    .set('Cookie', auth.cookie)
                    .send({
                        budget: testbudget
                    })
                    .expect(201)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                        const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                        const idList = parsedDom.window.document.querySelectorAll("td.result_id");
                        const budgetList = parsedDom.window.document.querySelectorAll("td.result_budget");
                        const message = parsedDom.window.document.querySelector("li.confirm_msg");
    
                        // Test the result on screen against the testing data
                        expect(idList).is.length(1);
                        expect(budgetList).is.length(1);
                        expect(message.textContent).to.equal("Envelope ID (" + testId + ") has been updated.");
                        expect(parseInt(idList[0].textContent)).to.equal(testId);
                        expect(parseFloat(budgetList[0].textContent)).to.equal(testbudget);
    
                        return db.getDatabaseRecords({ user: auth.user, id: testId }, db.selectOneEnvelopeQuery).then((res) => {
                            // Test the result in DB against the testing data
                            expect(res).is.length(1);
                            expect(testId).to.equal(res[0].id);
                            expect(testbudget).to.equal(res[0].budget);
                        });
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
            });
    
            it('Update an envelope with only ID', function() {
                return request(server)
                    .post('/budget/envelopes/' + testId + '?_method=PUT')
                    .set('Cookie', auth.cookie)
                    .expect(500)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                        const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                        const message = parsedDom.window.document.querySelector("li.error_msg");
    
                        // Test the result on screen against the testing data
                        expect(message.textContent).to.equal("Error: Budget should be in numeric value.");
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
            });
    
            it('Update an envelope with budget in alphabet', function() {
                const testbudget = "Budget";
                return request(server)
                    .post('/budget/envelopes/' + testId + '?_method=PUT')
                    .set('Cookie', auth.cookie)
                    .send({
                        budget: testbudget
                    })
                    .expect(500)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                        const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                        const message = parsedDom.window.document.querySelector("li.error_msg");
    
                        // Test the result on screen against the testing data
                        expect(message.textContent).to.equal("Error: Budget should be in numeric value.");
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
            });
    
            it('Update with an invalid or non-exist envelope ID', function() {
                const invalidTestId = -1;
                const testname = "Test 3";
                const testbudget = 9.99;
                return request(server)
                    .post('/budget/envelopes/' + invalidTestId + '?_method=PUT')
                    .set('Cookie', auth.cookie)
                    .send({
                        name: testname, 
                        budget: testbudget
                    })
                    .expect(500)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                        const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                        const idList = parsedDom.window.document.querySelectorAll("td.result_id");
                        const message = parsedDom.window.document.querySelector("li.error_msg");
    
                        // Test the result on screen against the testing data
                        expect(idList).is.length(0);
                        expect(message.textContent).to.equal("Error: Missing or invalid envelope ID.");
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
            });
    
            it('Update without any envelope ID', function() {
                return request(server)
                    .post('/budget/envelopes/?_method=PUT')
                    .set('Cookie', auth.cookie)
                    .expect(303)
                    .expect((res) => {
                        expect(res.location, '/budget/envelopes');
                    });
            });
        });
    
        describe('Transfer budget between envelopes', function() {
            let sourceBudget;
            let targetBudget;
        
            before('Get the budget from the source envelope', () => {
                db.getDatabaseRecords({ user: auth.user, id: testId }, db.selectOneEnvelopeQuery).then((res) => {
                    sourceBudget = res[0].budget;
                });
            });
    
            before('Get the budget from the target envelope', () => {
                db.getDatabaseRecords({ user: auth.user, id: testId2 }, db.selectOneEnvelopeQuery).then((res) => {
                    targetBudget = res[0].budget;
                });
            });
    
            it('Post a new transfer between two envelopes', function() {
                const testbudget = 1;
                return request(server)
                    .post('/budget/envelopes/transfer/' + testId + '/' + testId2)
                    .set('Cookie', auth.cookie)
                    .send({
                        transfer_from: sourceBudget - testbudget,
                        transfer_to: targetBudget + testbudget,
                        budget: testbudget
                    })
                    .expect(201)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                        const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                        const idList = parsedDom.window.document.querySelectorAll("td.result_id");
                        const nameList = parsedDom.window.document.querySelectorAll("td.result_name");
                        const budgetList = parsedDom.window.document.querySelectorAll("td.result_budget");
                        const message = parsedDom.window.document.querySelector("li.confirm_msg");
    
                        // Test the result on screen against the testing data
                        expect(idList).is.length(2);
                        expect(nameList).is.length(2);
                        expect(budgetList).is.length(2);
                        // expect(message.textContent).to.equal("New envelope \"" + nameList[0].textContent + "\" has been created.");
                        expect(parseInt(idList[0].textContent)).to.equal(testId);
                        expect(parseInt(idList[1].textContent)).to.equal(testId2);
                        expect(parseFloat(budgetList[0].textContent)).to.equal(sourceBudget - testbudget);
                        expect(parseFloat(budgetList[1].textContent)).to.equal(targetBudget + testbudget);
    
                        return Promise.all([db.getDatabaseRecords({ user: auth.user, id: testId }, db.selectOneEnvelopeQuery).then((res) => {
                            // Test the result in DB against the testing data
                            expect(res).is.length(1);
                            expect(testId).to.equal(res[0].id);
                            expect(sourceBudget - testbudget).to.equal(res[0].budget);
                            return res;
                        }), db.getDatabaseRecords({ user: auth.user, id: testId2 }, db.selectOneEnvelopeQuery).then((res) => {
                            // Test the result in DB against the testing data
                            expect(res).is.length(1);
                            expect(testId2).to.equal(res[0].id);
                            expect(targetBudget + testbudget).to.equal(res[0].budget);
                            return res;
                        })]);
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
            });
    
            after('Clean up the 2nd created envelope', () => {
                // Remove the 2nd unit test record from DB as it will not be removed in delete route
                db.deleteDatabaseRecord({ user: auth.user, id: testId2 }, db.deleteOneEnvelopeQuery);
            })
    
            it('Post a new transfer without all necessary properties between two envelopes', function() {
                const testbudget = 1;
                return request(server)
                    .post('/budget/envelopes/transfer/' + testId)
                    .set('Cookie', auth.cookie)
                    .send({
                        budget: testbudget
                    })
                    .expect(303)
                    .expect((res) => {
                        expect(res.location, '/budget/envelopes');
                    });
            });
    
            it('Access new transfer route by using wrong HTTP method (GET)', function() {
                const testbudget = 1;
                return request(server)
                    .get('/budget/envelopes/transfer/' + testId + '/' + testId2)
                    .set('Cookie', auth.cookie)
                    .send({
                        budget: testbudget
                    })
                    .expect(303)
                    .expect((res) => {
                        expect(res.location, '/budget/envelopes');
                    });
            });
        });
        
        describe('Delete an envelope', function() {
            it('Delete an envelope with a valid envelope ID', function() {
                return request(server)
                    .post('/budget/envelopes/' + testId + '?_method=DELETE')
                    .set('Cookie', auth.cookie)
                    .expect(201)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                        const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                        const idList = parsedDom.window.document.querySelectorAll("td.result_id");
                        const message = parsedDom.window.document.querySelector("li.confirm_msg");
    
                        // Test the result on screen against the testing data
                        expect(idList).is.length(1);
                        expect(message.textContent).to.equal("Envelope ID (" + testId + ") has been deleted.");
                        expect(parseInt(idList[0].textContent)).to.equal(testId);
    
                        return db.getDatabaseRecords({ user: auth.user, id: testId }, db.selectOneEnvelopeQuery).then((res) => {
                            // Test the result in DB against the testing data
                            expect(res).to.be.null;
                        });
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
            });
    
            it('Delete with an invalid or non-exist envelope ID', function() {
                const invalidTestId = -1;
                return request(server)
                    .post('/budget/envelopes/' + invalidTestId + '?_method=DELETE')
                    .set('Cookie', auth.cookie)
                    .expect(500)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                        const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                        const idList = parsedDom.window.document.querySelectorAll("td.result_id");
                        const message = parsedDom.window.document.querySelector("li.error_msg");
    
                        // Test the result on screen against the testing data
                        expect(idList).is.length(0);
                        expect(message.textContent).to.equal("Error: Missing or invalid envelope ID.");
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
            });
    
            it('Delete without any envelope ID', function() {
                return request(server)
                    .post('/budget/envelopes/?_method=DELETE')
                    .set('Cookie', auth.cookie)
                    .expect(303)
                    .expect((res) => {
                        expect(res.location, '/budget/envelopes');
                    });
            });
        });
    });
    
    describe('Transactions functionalities (/budget/transactions)', function() {
        let testId = null;
        
        before('Get login cookie', loginUser(auth));
        
        describe('Retrieve transaction(s)', function() {
            it('Retrieve all transactions', function() {
                return request(server)
                    .get('/budget/transactions')
                    .set('Cookie', auth.cookie)
                    .set('Content-Type', 'text/html')
                    .expect(200)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        return db.getDatabaseRecords({ user: auth.user }, db.selectAllTransactionsQuery).then((res) => {
                            // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                            const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                            const idList = parsedDom.window.document.querySelectorAll("td.result_id");
                            const dateList = parsedDom.window.document.querySelectorAll("td.result_date");
                            const amountList = parsedDom.window.document.querySelectorAll("td.result_amount");
                            const recipientList = parsedDom.window.document.querySelectorAll("td.result_recipient");
                            const envelopeIdList = parsedDom.window.document.querySelectorAll("td.result_envelopeid");
    
                            for(let i = 0; i < res.length; i++) {
                                expect(parseInt(idList[i].textContent)).to.equal(res[i].id);
                                expect(dateList[i].textContent).to.equal(res[i].date.toDateString('en-GB'));
                                expect(parseFloat(amountList[i].textContent)).to.equal(res[i].amount);
                                expect(recipientList[i].textContent).to.equal(res[i].recipient);
                                expect(parseInt(envelopeIdList[i].textContent)).to.equal(res[i].envelopeId);
                            };
                        });
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
            });
    
            it('Retrieve a single transaction', function() {
                const id = 2;
                return request(server)
                    .get('/budget/transactions/' + id)
                    .set('Cookie', auth.cookie)
                    .set('Content-Type', 'text/html')
                    .expect(200)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        return db.getDatabaseRecords({ user: auth.user, id: id }, db.selectOneTransactionQuery).then((res) => {
                            // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                            const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                            const idList = parsedDom.window.document.querySelectorAll("td.result_id");
                            const dateList = parsedDom.window.document.querySelectorAll("td.result_date");
                            const amountList = parsedDom.window.document.querySelectorAll("td.result_amount");
                            const recipientList = parsedDom.window.document.querySelectorAll("td.result_recipient");
                            const envelopeIdList = parsedDom.window.document.querySelectorAll("td.result_envelopeid");
    
                            expect(res).is.length(1);
                            expect(parseInt(idList[0].textContent)).to.equal(res[0].id);
                            expect(dateList[0].textContent).to.equal(res[0].date.toDateString('en-GB'));
                            expect(parseFloat(amountList[0].textContent)).to.equal(res[0].amount);
                            expect(recipientList[0].textContent).to.equal(res[0].recipient);
                            expect(parseInt(envelopeIdList[0].textContent)).to.equal(res[0].envelopeId);
                        });
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
            });
    
            it('Retrieve a single envelope with invalid envelope ID', function() {
                const id = -1;
                return request(server)
                    .get('/budget/transactions/' + id)
                    .set('Cookie', auth.cookie)
                    .set('Content-Type', 'text/html')
                    .expect(500)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                        const idList = parsedDom.window.document.querySelectorAll("td.result_id");
                        const dateList = parsedDom.window.document.querySelectorAll("td.result_date");
                        const amountList = parsedDom.window.document.querySelectorAll("td.result_amount");
                        const recipientList = parsedDom.window.document.querySelectorAll("td.result_recipient");
                        const envelopeIdList = parsedDom.window.document.querySelectorAll("td.result_envelopeid");
                        const message = parsedDom.window.document.querySelector("li.error_msg");
    
                        expect(idList).is.length(0);
                        expect(dateList).is.length(0);
                        expect(amountList).is.length(0);
                        expect(recipientList).is.length(0);
                        expect(envelopeIdList).is.length(0);
                        expect(message.textContent).to.equal("Error: Missing or invalid transaction ID.");
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
            });
        });
    
        describe('Create a new transaction', function() {
            let envelopeBudget;
            const testEnvelopeId = 1;
        
            beforeEach('Get the budget from the envelope', () => {
                db.getDatabaseRecords({ user: auth.user, id: testEnvelopeId }, db.selectOneEnvelopeQuery).then((res) => {
                    envelopeBudget = res[0].budget;
                });
            });
    
            it('Post a new transaction with all properties available', function() {
                const testDate = "Sun Feb 02 2020";
                const testAmount = 2;
                const testRecipient = "Test transaction";
                return request(server)
                    .post('/budget/transactions')
                    .set('Cookie', auth.cookie)
                    .send({
                        date: testDate,
                        amount: testAmount,
                        recipient: testRecipient,
                        envelopeId: testEnvelopeId
                    })
                    .expect(201)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                        const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                        const idList = parsedDom.window.document.querySelectorAll("td.result_id");
                        const dateList = parsedDom.window.document.querySelectorAll("td.result_date");
                        const amountList = parsedDom.window.document.querySelectorAll("td.result_amount");
                        const recipientList = parsedDom.window.document.querySelectorAll("td.result_recipient");
                        const envelopeIdList = parsedDom.window.document.querySelectorAll("td.result_envelopeid");
                        const message = parsedDom.window.document.querySelector("li.confirm_msg");
    
                        // Test the result on screen against the testing data
                        expect(idList).is.length(1);
                        expect(dateList).is.length(1);
                        expect(amountList).is.length(1);
                        expect(recipientList).is.length(1);
                        expect(envelopeIdList).is.length(1);
                        expect(message.textContent).to.equal("New transaction of ID (" + idList[0].textContent + ") has been created.");
                        expect(idList[0].textContent).to.exist;
                        expect(dateList[0].textContent).to.equal(testDate);
                        expect(parseFloat(amountList[0].textContent)).to.equal(testAmount);
                        expect(recipientList[0].textContent).to.equal(testRecipient);
                        expect(parseInt(envelopeIdList[0].textContent)).to.equal(testEnvelopeId);
    
                        testId = parseInt(idList[0].textContent);
                        return Promise.all([db.getDatabaseRecords({ user: auth.user, id: testId }, db.selectOneTransactionQuery).then((res) => {
                            // Test the transaction result in DB against the testing data
                            expect(res).is.length(1);
                            expect(testId).to.equal(res[0].id);
                            expect(testDate).to.equal(res[0].date.toDateString('en-GB'));
                            expect(testAmount).to.equal(res[0].amount);
                            expect(testRecipient).to.equal(res[0].recipient);
                            expect(testEnvelopeId).to.equal(res[0].envelopeId);
                        }), db.getDatabaseRecords({ user: auth.user, id: testEnvelopeId }, db.selectOneEnvelopeQuery).then((res) => {
                            // Test the envelope budget in DB against the testing data
                            expect(res).is.length(1);
                            expect(envelopeBudget - testAmount).to.equal(res[0].budget);
                        })]);
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
            });
    
            it('Post a new transaction without envelope ID', function() {
                const testDate = "Sun Feb 02 2020";
                const testAmount = 3;
                const testRecipient = "No envelope ID";
                return request(server)
                    .post('/budget/transactions')
                    .set('Cookie', auth.cookie)
                    .send({
                        date: testDate,
                        amount: testAmount,
                        recipient: testRecipient
                    })
                    .expect(500)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                        const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                        const idList = parsedDom.window.document.querySelectorAll("td.result_id");
                        const dateList = parsedDom.window.document.querySelectorAll("td.result_date");
                        const amountList = parsedDom.window.document.querySelectorAll("td.result_amount");
                        const recipientList = parsedDom.window.document.querySelectorAll("td.result_recipient");
                        const message = parsedDom.window.document.querySelector("li.error_msg");
    
                        // Test the result on screen against the testing data
                        expect(idList).is.length(0);
                        expect(dateList).is.length(0);
                        expect(amountList).is.length(0);
                        expect(recipientList).is.length(0);
                        expect(message.textContent).to.equal("Missing envelope ID.");
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
            });
    
            it('Post a new transaction without date', function() {
                const testAmount = 3;
                const testRecipient = "No envelope ID";
                return request(server)
                    .post('/budget/transactions')
                    .set('Cookie', auth.cookie)
                    .send({
                        amount: testAmount,
                        recipient: testRecipient,
                        envelopeId: testEnvelopeId
                    })
                    .expect(500)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                        const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                        const idList = parsedDom.window.document.querySelectorAll("td.result_id");
                        const amountList = parsedDom.window.document.querySelectorAll("td.result_amount");
                        const recipientList = parsedDom.window.document.querySelectorAll("td.result_recipient");
                        const envelopeIdList = parsedDom.window.document.querySelectorAll("td.result_envelopeid");
                        const message = parsedDom.window.document.querySelector("li.error_msg");
    
                        // Test the result on screen against the testing data
                        expect(idList).is.length(0);
                        expect(amountList).is.length(0);
                        expect(recipientList).is.length(0);
                        expect(envelopeIdList).is.length(0);
                        expect(message.textContent).to.equal("Error: Date format is not valid.");

                        return db.getDatabaseRecords({ user: auth.user, id: testEnvelopeId }, db.selectOneEnvelopeQuery).then((res) => {
                            // Test the envelope budget in DB remain the same before and after this test
                            expect(res).is.length(1);
                            expect(envelopeBudget).to.equal(res[0].budget);
                        });
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
            });
    
            it('Post a new transaction with negative amount', function() {
                const testDate = "Sun Feb 02 2020";
                const testAmount = -2;
                const testRecipient = "Test transaction";
                return request(server)
                    .post('/budget/transactions')
                    .set('Cookie', auth.cookie)
                    .send({
                        date: testDate,
                        amount: testAmount,
                        recipient: testRecipient,
                        envelopeId: testEnvelopeId
                    })
                    .expect(500)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                        const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                        const idList = parsedDom.window.document.querySelectorAll("td.result_id");
                        const dateList = parsedDom.window.document.querySelectorAll("td.result_date");
                        const amountList = parsedDom.window.document.querySelectorAll("td.result_amount");
                        const recipientList = parsedDom.window.document.querySelectorAll("td.result_recipient");
                        const envelopeIdList = parsedDom.window.document.querySelectorAll("td.result_envelopeid");
                        const message = parsedDom.window.document.querySelector("li.error_msg");
    
                        // Test the result on screen against the testing data
                        expect(idList).is.length(0);
                        expect(dateList).is.length(0);
                        expect(amountList).is.length(0);
                        expect(recipientList).is.length(0);
                        expect(envelopeIdList).is.length(0);
                        expect(message.textContent).to.equal("Error: Amount should be either zero or positive.");
                    
                        return db.getDatabaseRecords({ user: auth.user, id: testEnvelopeId }, db.selectOneEnvelopeQuery).then((res) => {
                            // Test the envelope budget in DB remain the same before and after this test
                            expect(res).is.length(1);
                            expect(envelopeBudget).to.equal(res[0].budget);
                        });
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
            });
        });
    
        describe('Update a transaction', function() {
            let envelopeBudget;
            let originalAmount;
            const testEnvelopeId = 1;
        
            beforeEach('Get the budget from the envelope', () => {
                db.getDatabaseRecords({ user: auth.user, id: testEnvelopeId }, db.selectOneEnvelopeQuery).then((res) => {
                    envelopeBudget = res[0].budget;
                });
            });
    
            beforeEach('Get the original amount from the transaction', () => {
                expect(testId).to.be.not.NaN;
    
                db.getDatabaseRecords({ user: auth.user, id: testId }, db.selectOneTransactionQuery).then((res) => {
                    originalAmount = res[0].amount;
                });
            });
    
            it('Update a transaction with all properties available', function() {
                const testDate = "Sat Feb 01 2020";
                const testAmount = 5;
                const testRecipient = "Test transaction edited";
                return request(server)
                    .post('/budget/transactions/' + testId + '?_method=PUT')
                    .set('Cookie', auth.cookie)
                    .send({
                        date: testDate,
                        amount: testAmount,
                        recipient: testRecipient,
                        envelopeId: testEnvelopeId
                    })
                    .expect(201)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                        const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                        const idList = parsedDom.window.document.querySelectorAll("td.result_id");
                        const dateList = parsedDom.window.document.querySelectorAll("td.result_date");
                        const amountList = parsedDom.window.document.querySelectorAll("td.result_amount");
                        const recipientList = parsedDom.window.document.querySelectorAll("td.result_recipient");
                        const envelopeIdList = parsedDom.window.document.querySelectorAll("td.result_envelopeid");
                        const message = parsedDom.window.document.querySelector("li.confirm_msg");
    
                        // Test the result on screen against the testing data
                        expect(idList).is.length(1);
                        expect(dateList).is.length(1);
                        expect(amountList).is.length(1);
                        expect(recipientList).is.length(1);
                        expect(envelopeIdList).is.length(1);
                        expect(message.textContent).to.equal("Transaction ID (" + idList[0].textContent + ") has been updated.");
                        expect(parseInt(idList[0].textContent)).to.equal(testId);
                        expect(dateList[0].textContent).to.equal(testDate);
                        expect(parseFloat(amountList[0].textContent)).to.equal(testAmount);
                        expect(recipientList[0].textContent).to.equal(testRecipient);
                        expect(parseInt(envelopeIdList[0].textContent)).to.equal(testEnvelopeId);
    
                        return Promise.all([db.getDatabaseRecords({ user: auth.user, id: testId }, db.selectOneTransactionQuery).then((res) => {
                            // Test the result in DB against the testing data
                            expect(res).is.length(1);
                            expect(testId).to.equal(res[0].id);
                            expect(testDate).to.equal(res[0].date.toDateString('en-GB'));
                            expect(testAmount).to.equal(res[0].amount);
                            expect(testRecipient).to.equal(res[0].recipient);
                            expect(testEnvelopeId).to.equal(res[0].envelopeId);
                        }), db.getDatabaseRecords({ user: auth.user, id: testEnvelopeId }, db.selectOneEnvelopeQuery).then((res) => {
                            // Test the result in DB against the testing data
                            expect(res).is.length(1);
                            expect(envelopeBudget - testAmount + originalAmount).to.equal(res[0].budget);
                        })]);
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
            });
    
            it('Update a transaction with only part of properties available', function() {
                const testAmount = 1;
                return request(server)
                    .post('/budget/transactions/' + testId + '?_method=PUT')
                    .set('Cookie', auth.cookie)
                    .send({
                        amount: testAmount
                    })
                    .expect(201)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                        const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                        const idList = parsedDom.window.document.querySelectorAll("td.result_id");
                        const amountList = parsedDom.window.document.querySelectorAll("td.result_amount");
                        const message = parsedDom.window.document.querySelector("li.confirm_msg");
    
                        // Test the result on screen against the testing data
                        expect(idList).is.length(1);
                        expect(amountList).is.length(1);
                        expect(message.textContent).to.equal("Transaction ID (" + idList[0].textContent + ") has been updated.");
                        expect(parseInt(idList[0].textContent)).to.equal(testId);
                        expect(parseFloat(amountList[0].textContent)).to.equal(testAmount);
    
                        return Promise.all([db.getDatabaseRecords({ user: auth.user, id: testId }, db.selectOneTransactionQuery).then((res) => {
                            // Test the result in DB against the testing data
                            expect(res).is.length(1);
                            expect(testId).to.equal(res[0].id);
                            expect(testAmount).to.equal(res[0].amount);
                        }), db.getDatabaseRecords({ user: auth.user, id: testEnvelopeId }, db.selectOneEnvelopeQuery).then((res) => {
                            // Test the result in DB against the testing data
                            expect(res).is.length(1);
                            expect(envelopeBudget - testAmount + originalAmount).to.equal(res[0].budget);
                        })]);
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
            });
    
            it('Update a transaction with only ID', function() {
                return request(server)
                    .post('/budget/transactions/' + testId + '?_method=PUT')
                    .set('Cookie', auth.cookie)
                    .expect(201)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                        const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                        const idList = parsedDom.window.document.querySelectorAll("td.result_id");
                        const amountList = parsedDom.window.document.querySelectorAll("td.result_amount");
                        const message = parsedDom.window.document.querySelector("li.confirm_msg");
    
                        // Test the result on screen against the testing data
                        expect(idList).is.length(1);
                        expect(amountList).is.length(1);
                        expect(message.textContent).to.equal("Transaction ID (" + idList[0].textContent + ") has been updated.");
                        expect(parseInt(idList[0].textContent)).to.equal(testId);
                        expect(parseFloat(amountList[0].textContent)).to.equal(originalAmount);
    
                        return Promise.all([db.getDatabaseRecords({ user: auth.user, id: testId }, db.selectOneTransactionQuery).then((res) => {
                            // Test the result in DB against the testing data
                            expect(res).is.length(1);
                            expect(testId).to.equal(res[0].id);
                            expect(originalAmount).to.equal(res[0].amount);
                        }), db.getDatabaseRecords({ user: auth.user, id: testEnvelopeId }, db.selectOneEnvelopeQuery).then((res) => {
                            // Test the result in DB against the testing data
                            expect(res).is.length(1);
                            expect(envelopeBudget).to.equal(res[0].budget);
                        })]);
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
            });
    
            it('Update a transaction with budget in alphabet', function() {
                const testAmount = "transaction";
                return request(server)
                    .post('/budget/transactions/' + testId + '?_method=PUT')
                    .set('Cookie', auth.cookie)
                    .send({
                        amount: testAmount
                    })
                    .expect(500)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                        const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                        const message = parsedDom.window.document.querySelector("li.error_msg");
    
                        // Test the result on screen against the testing data
                        expect(message.textContent).to.equal("Error: Amount should be in numeric value.");
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
            });
    
            it('Update with an invalid or non-exist transaction ID', function() {
                const invalidTestId = -1;
                const testDate = "Sat Feb 01 2020";
                const testAmount = 5;
                const testRecipient = "Test transaction edited2";
                return request(server)
                    .post('/budget/transactions/' + invalidTestId + '?_method=PUT')
                    .set('Cookie', auth.cookie)
                    .send({
                        date: testDate,
                        amount: testAmount,
                        recipient: testRecipient,
                        envelopeId: testEnvelopeId
                    })
                    .expect(500)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                        const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                        const idList = parsedDom.window.document.querySelectorAll("td.result_id");
                        const message = parsedDom.window.document.querySelector("li.error_msg");
    
                        // Test the result on screen against the testing data
                        expect(idList).is.length(0);
                        expect(message.textContent).to.equal("Error: Missing or invalid transaction ID.");
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
            });
    
            it('Update without any transaction ID', function() {
                return request(server)
                    .post('/budget/transactions/?_method=PUT')
                    .set('Cookie', auth.cookie)
                    .expect(303)
                    .expect((res) => {
                        expect(res.location, '/budget/transactions');
                    });
            });
        });
    
        describe('Delete a transaction', function() {
            let envelopeBudget;
            let originalAmount;
            const testEnvelopeId = 1;
        
            beforeEach('Get the budget from the envelope', () => {
                db.getDatabaseRecords({ user: auth.user, id: testEnvelopeId }, db.selectOneEnvelopeQuery).then((res) => {
                    envelopeBudget = res[0].budget;
                });
            });
    
            beforeEach('Get the original amount from the transaction', () => {
                expect(testId).to.be.not.NaN;
    
                db.getDatabaseRecords({ user: auth.user, id: testId }, db.selectOneTransactionQuery).then((res) => {
                    originalAmount = res[0].amount;
                });
            });
    
            it('Delete a transaction with a valid transaction ID', function() {
                return request(server)
                    .post('/budget/transactions/' + testId + '?_method=DELETE')
                    .set('Cookie', auth.cookie)
                    .expect(201)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                        const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                        const idList = parsedDom.window.document.querySelectorAll("td.result_id");
                        const message = parsedDom.window.document.querySelector("li.confirm_msg");
    
                        // Test the result on screen against the testing data
                        expect(idList).is.length(1);
                        expect(message.textContent).to.equal("Transaction ID (" + testId + ") has been deleted.");
                        expect(parseInt(idList[0].textContent)).to.equal(testId);
    
                        return Promise.all([db.getDatabaseRecords({ user: auth.user, id: testId }, db.selectOneTransactionQuery).then((res) => {
                            // Test the result in DB against the testing data
                            expect(res).to.be.null;
                        }), db.getDatabaseRecords({ user: auth.user, id: testEnvelopeId }, db.selectOneEnvelopeQuery).then((res) => {
                            // Test the result in DB against the testing data
                            expect(res).is.length(1);
                            expect(envelopeBudget + originalAmount).to.equal(res[0].budget);
                        })]);
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
            });
    
            it('Delete with an invalid or non-exist transaction ID', function() {
                const invalidTestId = -1;
                return request(server)
                    .post('/budget/transactions/' + invalidTestId + '?_method=DELETE')
                    .set('Cookie', auth.cookie)
                    .expect(500)
                    .then((res) => {
                        expect(res.text).to.not.be.null;
                        expect(res.text).to.not.be.undefined;
                        htmlResponse = res.text;
    
                        // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                        const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                        const idList = parsedDom.window.document.querySelectorAll("td.result_id");
                        const message = parsedDom.window.document.querySelector("li.error_msg");
    
                        // Test the result on screen against the testing data
                        expect(idList).is.length(0);
                        expect(message.textContent).to.equal("Error: Missing or invalid transaction ID.");
                    })
                    .catch((err) => {
                        if (err) throw err;
                    });
            });
    
            it('Delete without any transaction ID', function() {
                return request(server)
                    .post('/budget/transactions/?_method=DELETE')
                    .set('Cookie', auth.cookie)
                    .expect(303)
                    .expect((res) => {
                        expect(res.location, '/budget/transactions');
                    });
            });
        });
    });
});