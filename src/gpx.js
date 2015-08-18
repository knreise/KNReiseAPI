/*global toGeoJSON: false */
var KR = this.KR || {};

KR.GpxAPI = function (apiName) {
    'use strict';

    function getData(dataset, callback, errorCallback) {

        if (typeof toGeoJSON === 'undefined') {
            throw new Error('toGeoJSON not found!');
        }
        var url = dataset.url;
        KR.Util.sendRequest(url, toGeoJSON.gpx, callback, errorCallback);
    }

    return {
        getData: getData
    };
};
