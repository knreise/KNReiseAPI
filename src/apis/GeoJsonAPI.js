import sendRequest from '../util/sendRequest';
import {addCrossorigin} from '../util';

export default function GeoJsonAPI(apiName) {

    function parse(d) {
        return JSON.parse(d);
    }

    function getData(dataset, callback, errorCallback) {
        var url = dataset.corsProxy
        ? addCrossorigin(dataset.url)
        : dataset.url;
        sendRequest(url, parse, callback, errorCallback);
    }

    return {
        getData: getData
    };
};
