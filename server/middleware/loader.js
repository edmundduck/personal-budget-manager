const responseHandler = (req, res, next) => {
    const result = req.result;
    const page = req.page;
    if (result instanceof Promise) {
        result.then((resolve, reject) => {
            if (reject) {
                res.status(500).send('Error database processing. The change may not have been effective in the database.');
            } else {
                // res.status(req.code_success).send(resolve);
                res.render(page, { data: resolve, error_msg: null });
            }
        }).catch((error) => {
            // res.status(500).send(error.message);
            res.render(page, { data: null, error_msg: [error.message] });
        });
    } else if (result) {
        // res.status(200).send(result);
        res.render(page, { data: result, error_msg: null });
    } else {
        // res.status(404).send('No result was returned.');
        res.render(page, { data: null, error_msg: ['No result was returned.'] });
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

module.exports = { 
    responseHandler,
    promiseLoader,
    twoPromisesLoader
};