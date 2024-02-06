const parameters = process.argv;
const express = require('express');
// fake_db.js for simulation using a fake file (not a connectable db)
const db = parameters[2] == 'fakedb' ? require('../fake_db.js') : require('../postgresdb.js');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const authRouter = express.Router();
const user = require('../../entity/user.js');
const url = require('url');

const debugSession = (req, res, next) => {
    console.log("\n==============================")
    console.log(`req.body.username -------> ${req.body.username}`) 
    console.log(`req.body.password -------> ${req.body.password}`)

    console.log(`\n req.session.passport -------> `)
    console.log(req.session.passport)
  
    console.log(`\n req.user -------> `) 
    console.log(req.user) 
  
    console.log("\n Session and Cookie")
    console.log(`req.session.id -------> ${req.session.id}`) 
    console.log(`req.session.cookie -------> `) 
    console.log(req.session.cookie) 
  
    console.log("===========================================\n")

    next()
}

authRouter.use((req, res, next) => {
    req.page = 'login';
    next();
});

passport.use(new LocalStrategy(async (username, password, done) => {
    let userResult = null;
    try{
        userResult = await db.getDatabaseRecords({ email: username }, db.selectOneUserQuery);
    } catch(err) {
        // return done(err);
        return done(null, false, { error_msg: 'Internal connection error, please try again later.' });
    }

    if (!userResult || userResult.length <= 0) {
        return done(null, false, { error_msg: 'User does not exist.' });
    }

    const matchedHash = await bcrypt.compare(password, userResult[0].hash);
    if (!matchedHash) {
        return done(null, false, { error_msg: 'Password does not match.' });
    }

    return done(null, userResult[0]);
}));

passport.serializeUser((user, done) => {
    done(null, {
        id: user.id,
        name: user.name,
        email: user.email
    });
});
  
passport.deserializeUser(async (user, done) => {
    const userResult = await db.getDatabaseRecords({ email: user.email }, db.selectOneUserQuery);
    // TODO test userResult = not truthy
    if (!userResult) {
        done(new Error('Error retrieving user record.'));
    } else if (userResult instanceof Promise) {
        userResult.catch((err) => done(err));
    }

    return done(null, userResult);
});

const checkAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) { 
        return next();
    }
    res.redirect('/login');
}

authRouter.get('/', (req, res, next) => {
    const username = req.query.username ? decodeURIComponent(req.query.username) : null;
    const message = req.query.confirm_msg ? decodeURIComponent(req.query.confirm_msg) : null;
    const errorMessage = req.query.error_msg ? decodeURIComponent(req.query.error_msg) : null;
    res.render('login', { data: {username: username}, confirm_msg: message, error_msg: errorMessage });
});

authRouter.post('/', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            return res.status(401).render('login', { data: {username: req.body.username}, confirm_msg: null, error_msg: [info.error_msg] });
        }
        if (!user) {
            return res.status(401).render('login', { data: {username: req.body.username}, confirm_msg: null, error_msg: [info.error_msg] });
        }

        req.logIn(user, (err) => {
            if (err) {
                return res.status(401).render('login', { data: {username: req.body.username}, confirm_msg: null, error_msg: [info.error_msg] });
            }
            return res.redirect('../budget');
        });
    })(req, res, next);
});
        
// authRouter.post('/', passport.authenticate('local', {
//     failureRedirect: '/login',
//     successRedirect: '/budget',
//     failureMessage: true
// }));

authRouter.get('/new-user', (req, res, next) => {
    res.render('register', { error_msg: null, username: null, fullname: null });
});

authRouter.post('/new-user', async (req, res, next) => {
    const password = req.body.password;
    const passwordConfirm = req.body.passwordconfirm;
    const errorMsg = [];

    if (password != passwordConfirm) {
        errorMsg.push('Password does not match.');
        res.status(401).render('register', { error_msg: errorMsg, username: req.body.username, fullname: req.body.fullname });
        return;
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const newUserObj = new user({
        name: req.body.fullname,
        email: req.body.username,
        hash: hash
    });
    try{
        const userResult = await db.createUpdateDatabaseRecord({ obj:newUserObj }, db.createUserQuery, null);
        res.status(201).redirect(url.format({
            pathname: '/login',
            query: {
                "confirm_msg": 'Account has been created successfully. Please login with your new account.'
            }
        }));
    } catch(err) {
        errorMsg.push(err.message);
        res.status(500).render('register', { error_msg: errorMsg, username: req.body.username, fullname: req.body.fullname });
    }
});

module.exports = {
    authRouter,
    checkAuthenticated
};