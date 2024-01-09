const express = require('express');
const app = express();
const PORT = 3000;

const auth = require('./server/authenticate');
const baseRouter = require('./server/api');
const passport = require('passport');
const session = require("express-session");
const store = new session.MemoryStore();
app.use(express.static('html'));
app.use(express.static('public'));
app.set('view engine', 'ejs');

app.use(
    session({
      secret: "secret-key",
      resave: false,
      saveUninitialized: false,
      store,
    })
  );
    
app.use(passport.initialize());
app.use(passport.session());

// IMPORTANT - to load form input fields into req.body
app.use(express.urlencoded({ extended: true }));
app.use('/login', auth.authRouter);
app.use('/budget', baseRouter);
app.use('/logout',(req, res, next) => {
    req.logOut((err) => {
        if (err) {
            return next(err);
        }
        res.redirect('/login');
    });
});

app.listen(PORT, () => {
    console.log(`Server started, listening to the port ${PORT}...`);
});