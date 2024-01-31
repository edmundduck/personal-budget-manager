const expect = require('chai').expect;
const request = require('supertest');
const { server } = require('../server');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const parameters = process.argv;
// fake_db.js for simulation using a fake file (not a connectable db)
const db = parameters[2] == 'fakedb' ? require('../server/fake_db.js') : require('../server/postgresdb.js');

function loginUser(auth) {
    return function(done) {
        request(server)
            .post('/login')
            .send({
                username: 'tester01@local.com',
                password: 'tester01'
            })
            .end((err, res) => {
                if (err) return done(err);
                expect(res.headers).to.have.property('set-cookie');
                auth.cookie = res.headers['set-cookie'].pop().split(';')[0];
                done();
            });
    }
}

describe('Generic functionalities', function() {
    describe('Login and logout', function() {
        let auth = {};
        before(loginUser(auth));

        it('Log in with an invalid user', () => {
            return request(server)
                .post('/login')
                .send({
                    username: 'tester@local.com',
                    password: 'tester'
                })
                .expect(401);
            }
        );
                
        it('Log in with a valid user but invalid password', () => {
            return request(server)
                .post('/login')
                .send({
                    username: 'tester01@local.com',
                    password: 'tester'
                })
                .expect(401);
            }
        );
                
        it('Log in with a valid user', () => {
            return request(server)
                .post('/login')
                .send({
                    username: 'tester01@local.com',
                    password: 'tester01'
                })
                .expect(302)
                .expect((res) => {
                    expect(res.location, '../budget');
                });
            }
        );
                
        it('Log out', function() {
            return request(server)
                .get('/logout')
                .set('Cookie', auth.cookie)
                .expect(302)
                .expect((res) => {
                    expect(res.location, '../login');
                });
            }
        );
    });
});

describe('Envelopes functionalities (/budget/envelopes)', function() {
    let auth = {};
    let testId = null;
    let testId2 = null;
    before(loginUser(auth));
    
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

                    return db.getDatabaseRecords(null, db.selectAllEnvelopesQuery).then((res) => {
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
            return request(server)
                .get('/budget/envelopes/1')
                .set('Cookie', auth.cookie)
                .set('Content-Type', 'text/html')
                .expect(200)
                .then((res) => {
                    expect(res.text).to.not.be.null;
                    expect(res.text).to.not.be.undefined;
                    htmlResponse = res.text;

                    return db.getDatabaseRecords(1, db.selectOneEnvelopeQuery).then((res) => {
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
            const id = -1
            return request(server)
                .get('/budget/envelopes/' + id)
                .set('Cookie', auth.cookie)
                .set('Content-Type', 'text/html')
                .expect(200)
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
                    expect(message.textContent).to.equal("No data returned.")
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
                    expect(message.textContent).to.equal("New envelope \"" + nameList[0].textContent + "\" has been created.")
                    expect(idList[0].textContent).to.exist;
                    expect(nameList[0].textContent).to.equal(testname);
                    expect(parseFloat(budgetList[0].textContent)).to.equal(testbudget);

                    testId = parseInt(idList[0].textContent);
                    return db.getDatabaseRecords(testId, db.selectOneEnvelopeQuery).then((res) => {
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
                    expect(message.textContent).to.equal("New envelope \"" + nameList[0].textContent + "\" has been created.")
                    expect(idList[0].textContent).to.exist;
                    expect(nameList[0].textContent).to.be.empty;
                    expect(parseFloat(budgetList[0].textContent)).to.equal(testbudget);

                    testId2 = parseInt(idList[0].textContent);
                    return db.getDatabaseRecords(testId2, db.selectOneEnvelopeQuery).then((res) => {
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
                .expect(501)
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
                    expect(message.textContent).to.equal("Validation on the data object fails, database processsing is aborted.")
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
                .expect(501)
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
                    expect(message.textContent).to.equal("Validation on the data object fails, database processsing is aborted.")
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
                    id: testId,
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
                    expect(message.textContent).to.equal("Envelope ID (" + testId + ") has been updated.")
                    expect(parseInt(idList[0].textContent)).to.equal(testId);
                    expect(nameList[0].textContent).to.equal(testname);
                    expect(parseFloat(budgetList[0].textContent)).to.equal(testbudget);

                    return db.getDatabaseRecords(testId, db.selectOneEnvelopeQuery).then((res) => {
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
                    id: testId,
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
                    expect(message.textContent).to.equal("Envelope ID (" + testId + ") has been updated.")
                    expect(parseInt(idList[0].textContent)).to.equal(testId);
                    expect(parseFloat(budgetList[0].textContent)).to.equal(testbudget);

                    return db.getDatabaseRecords(testId, db.selectOneEnvelopeQuery).then((res) => {
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
                .send({
                    id: testId
                })
                .expect(501)
                .then((res) => {
                    expect(res.text).to.not.be.null;
                    expect(res.text).to.not.be.undefined;
                    htmlResponse = res.text;

                    // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                    const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                    const message = parsedDom.window.document.querySelector("li.error_msg");

                    // Test the result on screen against the testing data
                    expect(message.textContent).to.equal("Validation on the data object fails, database processsing is aborted.")
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
                    id: testId,
                    budget: testbudget
                })
                .expect(501)
                .then((res) => {
                    expect(res.text).to.not.be.null;
                    expect(res.text).to.not.be.undefined;
                    htmlResponse = res.text;

                    // console.log parsed DOM cannot get a meaningful result for debug as it does not display the content.
                    const parsedDom = new JSDOM(htmlResponse, {url: "http://localhost:3000/", contentType: "text/html"});
                    const message = parsedDom.window.document.querySelector("li.error_msg");

                    // Test the result on screen against the testing data
                    expect(message.textContent).to.equal("Validation on the data object fails, database processsing is aborted.")
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
                    id: invalidTestId,
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
                    const message = parsedDom.window.document.querySelector("li.error_msg");

                    // Test the result on screen against the testing data
                    expect(idList).is.length(0);
                    expect(message.textContent).to.equal("No data returned.")
                })
                .catch((err) => {
                    if (err) throw err;
                });
        });

        it('Update without any envelope ID', function() {
            return request(server)
                .post('/budget/envelopes/?_method=PUT')
                .set('Cookie', auth.cookie)
                .send({
                })
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
            db.getDatabaseRecords(testId, db.selectOneEnvelopeQuery).then((res) => {
                sourceBudget = res[0].budget;
            });
        });

        before('Get the budget from the target envelope', () => {
            db.getDatabaseRecords(testId2, db.selectOneEnvelopeQuery).then((res) => {
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
                    // expect(message.textContent).to.equal("New envelope \"" + nameList[0].textContent + "\" has been created.")
                    expect(parseInt(idList[0].textContent)).to.equal(testId);
                    expect(parseInt(idList[1].textContent)).to.equal(testId2);
                    expect(parseFloat(budgetList[0].textContent)).to.equal(sourceBudget - testbudget);
                    expect(parseFloat(budgetList[1].textContent)).to.equal(targetBudget + testbudget);

                    return Promise.all([db.getDatabaseRecords(testId, db.selectOneEnvelopeQuery).then((res) => {
                        // Test the result in DB against the testing data
                        expect(res).is.length(1);
                        expect(testId).to.equal(res[0].id);
                        expect(sourceBudget - testbudget).to.equal(res[0].budget);
                        return res;
                    }), db.getDatabaseRecords(testId2, db.selectOneEnvelopeQuery).then((res) => {
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

        after(() => {
            // Remove the 2nd unit test record from DB as it will not be removed in delete route
            db.deleteDatabaseRecord(testId2, db.deleteOneEnvelopeQuery);
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
                .send({
                    id: testId,
                })
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
                    expect(message.textContent).to.equal("Envelope ID (" + testId + ") has been deleted.")
                    expect(parseInt(idList[0].textContent)).to.equal(testId);

                    return db.getDatabaseRecords(testId, db.selectOneEnvelopeQuery).then((res) => {
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
                .send({
                    id: invalidTestId
                })
                .expect(201)
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
                    expect(message.textContent).to.equal("No data returned.")
                })
                .catch((err) => {
                    if (err) throw err;
                });
        });

        it('Delete without any envelope ID', function() {
            return request(server)
                .post('/budget/envelopes/?_method=DELETE')
                .set('Cookie', auth.cookie)
                .send({
                })
                .expect(303)
                .expect((res) => {
                    expect(res.location, '/budget/envelopes');
                });
        });
    });
});