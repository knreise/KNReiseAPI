
var KR = this.KR || {};

KR.GeoJsonAPI = function (apiName) {
    'use strict';

    function getData(dataset, callback, errorCallback) {
        var url = KR.Util.addCrossorigin(dataset.url);
        KR.Util.sendRequest(url, JSON.parse, callback, errorCallback);
    }

    return {
        getData: getData
    };
};
