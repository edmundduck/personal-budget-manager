const responseHandler = (req, res, next) => {
    const result = req.result;
    const page = req.page;
    if (result instanceof Promise) {
        result.then((resolve) => {
            res.render(page, { data: resolve, error_msg: null });
        });
    } else if (result) {
        res.render(page, { data: result, error_msg: null });
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
    res.status(statusCode).render(page, { data: null, error_msg: [message] });
}

module.exports = { 
    responseHandler,
    promiseLoader,
    twoPromisesLoader,
    errorMessageHandler,
    errorRenderHandler
};