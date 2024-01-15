const express = require('express');
const app = express();
const PORT = 3000;

const { baseRouter } = require('./server/api/api');
app.use('/', baseRouter);

app.listen(PORT, () => {
    console.log(`Server started, listening to the port ${PORT}...`);
});