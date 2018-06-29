export default function handleError(errorCallback, error, data) {
    if (errorCallback) {
        errorCallback({'error': error, 'data': data});
        return;
    }
    throw new Error(error);
};