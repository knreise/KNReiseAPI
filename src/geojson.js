
var KR = this.KR || {};

KR.GeoJsonAPI = function (apiName) {
    'use strict';

    function getData(dataset, callback, errorCallback) {

        KR.Util.sendRequest(dataset.url, JSON.parse, callback, errorCallback);
    }

    return {
        getData: getData
    };
};
