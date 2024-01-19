const express = require('express');
const baseRouter = express();
const methodOverride = require('method-override');
const { authRouter } = require('./authenticate.js');
const { envelopeRouter } = require('./envelopes.js');
const transactionRouter = require('./transactions.js');
const { errorMessageHandler, errorRenderHandler } = require('../middleware/loader.js');
const passport = require('passport');
const session = require("express-session");
const store = new session.MemoryStore();
const url = require('url');

baseRouter.use(express.static('html'));
baseRouter.use(express.static('public'));
// override with POST having ?_method=DELETE
baseRouter.use(methodOverride('_method'));
baseRouter.set('view engine', 'ejs');
// IMPORTANT - to load form input fields into req.body
baseRouter.use(express.urlencoded({ extended: true }));

baseRouter.use(
    session({
      secret: "secret-key",
      resave: false,
      saveUninitialized: false,
      store,
    })
  );
baseRouter.use(passport.initialize());
baseRouter.use(passport.session());

baseRouter.get('/', (req, res, next) => {
    res.redirect('/login');
});
baseRouter.use('/login', authRouter);
baseRouter.get('/budget', (req, res, next) => {
    res.locals.session = req.session;
    res.render('main');
});
baseRouter.use('/budget/envelopes', envelopeRouter);
baseRouter.use('/budget/transactions', transactionRouter);
baseRouter.get('/logout', (req, res, next) => {
    const username = req.user ? encodeURIComponent(req.user[0].email) : null;
    req.logOut((err) => {
        if (err) {
            return next(err);
        }
        res.redirect(url.format({
            pathname: '/login',
            query: { 
                "username": username 
            }
        }));
    });
});
baseRouter.use(errorMessageHandler, errorRenderHandler);

module.exports = { 
    baseRouter
};