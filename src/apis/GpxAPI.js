import toGeoJSON from '@mapbox/togeojson';

import sendRequest from '../util/sendRequest';
import {addCrossorigin} from '../util';

export default function GpxAPI(apiName) {

    function getData(dataset, callback, errorCallback) {

        if (typeof toGeoJSON === 'undefined') {
            throw new Error('toGeoJSON not found!');
        }
        var url = addCrossorigin(dataset.url);
        sendRequest(url, toGeoJSON.gpx, callback, errorCallback);
    }

    return {
        getData: getData
    };
};
