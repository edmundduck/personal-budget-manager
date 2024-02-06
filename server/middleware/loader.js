const { formatArray } = require('../util.js');

const responseHandler = (req, res, next) => {
    const result = req.result;
    const page = req.page;
    let statusCode = req.code_success || 200;
    const message = formatArray(req.message);
    const errorMessage = formatArray(req.session.error_msg, []);
    // Reset error message in session
    req.session.error_msg = null;
    if (result instanceof Promise) {
        result.then((resolve) => {
            if (resolve) {
                res.status(statusCode).render(page, { data: resolve, confirm_msg: message, error_msg: errorMessage });
            } else {
                errorMessage.push('No data returned.');
                res.status(statusCode).render(page, { data: null, confirm_msg: null, error_msg: errorMessage });
            }
        }).catch((error) => {
            res.status(501).render(page, { data: null, confirm_msg: null, error_msg: error.message });
        });
    } else if (result) {
        res.status(statusCode).render(page, { data: result, confirm_msg: message, error_msg: errorMessage });
    }
}

const promiseLoader = async (req, res, next) => {
    const result = req.result;
    await result.then((res) => {
        req.result = res;
    }).catch((error) => {
        next(error);
        return;
    });
    next();
}

const twoPromisesLoader = async (req, res, next) => {
    const resultOne = req.resultOne;
    const resultTwo = req.resultTwo;
    await Promise.all([resultOne, resultTwo]).then((res) => {
        req.resultOne = res[0];
        req.resultTwo = res[1];
    }).catch((error) => {
        next(error);
        return;
    });
    next();
}

const errorMessageHandler = (err, req, res, next) => {
    // console.log('Error: ' + err.message);
    next(err);
}

// Validation error goes here
const errorRenderHandler = (err, req, res, next) => {
    const page = req.page || 'general_fault';
    const statusCode = err.status || 500;
    let message;
    if (err instanceof Error) {
        message = [err.message] || ["Something went wrong, please refresh the page and try again."];
    } else if (Array.isArray(err)) {
        message = err;
    } else {
        message = [err];
    }
    res.status(statusCode).render(page, { data: null, confirm_msg: null, error_msg: message });
}

module.exports = { 
    responseHandler,
    promiseLoader,
    twoPromisesLoader,
    errorMessageHandler,
    errorRenderHandler
};