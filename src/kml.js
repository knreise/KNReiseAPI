/*global toGeoJSON: false */
var KR = this.KR || {};

KR.KmlAPI = function () {
    'use strict';

    function getData(dataset, callback, errorCallback) {

        if (typeof toGeoJSON === 'undefined') {
            throw new Error('toGeoJSON not found!');
        }
        var url = dataset.url;
        KR.Util.sendRequest(url, toGeoJSON.kml, callback, errorCallback);
    }

    return {
        getData: getData
    };
};