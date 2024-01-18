const responseHandler = (req, res, next) => {
    const result = req.result;
    const page = req.page;
    const statusCode = req.code_success || 200;
    const message = req.message && Array.isArray(req.message) ? req.message : (req.message ? [req.message] : null);
    if (result instanceof Promise) {
        result.then((resolve) => {
            res.status(statusCode).render(page, { data: resolve, confirm_msg: message, error_msg: null });
        });
    } else if (result) {
        res.status(statusCode).render(page, { data: result, confirm_msg: message, error_msg: null });
    }
}

const promiseLoader = async (req, res, next) => {
    const result = req.result;
    await result.then((res) => {
        req.result = res;
    });
    next();
}

const twoPromisesLoader = async (req, res, next) => {
    const resultOne = req.resultOne;
    const resultTwo = req.resultTwo;
    await Promise.all([resultOne, resultTwo]).then((res) => {
        req.resultOne = res[0];
        req.resultTwo = res[1];
    });
    next();
}

const errorMessageHandler = (err, req, res, next) => {
    console.log('Error: ' + err.message);
    next(err);
}

const errorRenderHandler = (err, req, res, next) => {
    const page = req.page;
    const statusCode = err.status || 500;
    const message = err.message || "Something went wrong, please refresh the page and try again.";
    res.status(statusCode).render(page, { data: null, confirm_msg: null, error_msg: [message] });
}

module.exports = { 
    responseHandler,
    promiseLoader,
    twoPromisesLoader,
    errorMessageHandler,
    errorRenderHandler
};