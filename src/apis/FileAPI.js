import * as _ from 'underscore';

import sendRequest from '../util/sendRequest';
import {addCrossorigin} from '../util';

export default function FileAPI(apiName, options) {

    function defaultParser(data) {
        return data;
    }

    function getData(dataset, callback, errorCallback) {
        var useCorsproxy = _.has(dataset, 'corsProxy')
            ? dataset.corsProxy
            : true;

        var url = useCorsproxy
            ? addCrossorigin(dataset.url)
            : dataset.url;

        var parser = options.parser || defaultParser;

        sendRequest(url, parser, callback, errorCallback);
    }

    return {
        getData: getData
    };
};
