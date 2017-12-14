/*global toGeoJSON: false */
var KR = this.KR || {};

KR.KmlAPI = function (apiName) {
    'use strict';

    function parse(data) {
        return toGeoJSON.kml(data)
    }

    function getData(dataset, callback, errorCallback) {

        if (typeof toGeoJSON === 'undefined') {
            throw new Error('toGeoJSON not found!');
        }
        var url = KR.Util.addCrossorigin(dataset.url);
        KR.Util.sendRequest(url, parse, callback, errorCallback);
    }

    return {
        getData: getData
    };
};