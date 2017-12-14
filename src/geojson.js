
var KR = this.KR || {};

KR.GeoJsonAPI = function (apiName) {
    'use strict';

    function parse (d) {
      return JSON.parse(d);
    }

    function getData(dataset, callback, errorCallback) {
        var url = dataset.corsProxy 
        ? KR.Util.addCrossorigin(dataset.url)
        : dataset.url;
        KR.Util.sendRequest(url, parse, callback, errorCallback);
    }

    return {
        getData: getData
    };
};
