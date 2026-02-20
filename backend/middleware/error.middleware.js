const globalErrorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (process.env.NODE_ENV === 'development') {
        res.status(err.statusCode).json({
            status: err.status,
            error: err,
            message: err.message,
            stack: err.stack
        });
    } else {
        let error = { ...err };
        error.message = err.message;
        error.statusCode = err.statusCode || 500;

        if (err.name === 'CastError') {
            error.message = `Invalid ${err.path}: ${err.value}.`;
            error.statusCode = 400;
            error.isOperational = true;
        }

        if (err.code === 11000) {
            const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
            error.message = `Duplicate field value: ${value}. Please use another value!`;
            error.statusCode = 400;
            error.isOperational = true;
        }

        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(el => el.message);
            error.message = `Invalid input data. ${messages.join('. ')}`;
            error.statusCode = 400;
            error.isOperational = true;
        }

        // Production mode: Don't leak error details
        if (error.isOperational) {
            res.status(error.statusCode).json({
                status: error.status,
                message: error.message
            });
        } else {
            console.error('ERROR 💥', err);
            res.status(500).json({
                status: 'error',
                message: 'Something went very wrong!'
            });
        }
    }
};

export default globalErrorHandler;
