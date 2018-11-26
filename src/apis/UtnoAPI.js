import toGeoJSON from '@mapbox/togeojson';

import sendRequest from '../util/sendRequest';
import handleError from '../util/handleError';

export default function UtnoAPI(apiName, options) {

    var BASE_URL = options.baseUrl;

    function getData(dataset, callback, errorCallback) {

        if (typeof toGeoJSON === 'undefined') {
            throw new Error('toGeoJSON not found!');
        }

        if (dataset.type === 'gpx') {
            var url = BASE_URL + dataset.id + '/gpx/';
            sendRequest(url, toGeoJSON.gpx, callback, errorCallback);
        } else {
            handleError(errorCallback, 'Unknown type ' + dataset.type);
        }
    }

    return {
        getData: getData
    };
};