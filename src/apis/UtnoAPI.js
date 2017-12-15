import toGeoJSON from '@mapbox/togeojson';

import sendRequest from '../util/sendRequest';
import handleError from '../util/handleError';

export default function UtnoAPI(apiName) {

    function getData(dataset, callback, errorCallback) {

        if (typeof toGeoJSON === 'undefined') {
            throw new Error('toGeoJSON not found!');
        }

        if (dataset.type === 'gpx') {
            var url = 'http://ut.no/tur/' + dataset.id + '/gpx/';
            sendRequest(url, toGeoJSON.gpx, callback, errorCallback);
        } else {
            handleError(errorCallback, 'Unknown type ' + dataset.type);
        }
    }

    return {
        getData: getData
    };
};