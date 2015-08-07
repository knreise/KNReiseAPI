/*global toGeoJSON: false */
var KR = this.KR || {};

KR.JernbanemuseetAPI = function (API_KEY) {
    'use strict';

    var BASE_URL = 'https://api.kulturpunkt.org/v2/owners/54/groups/192';

    function _getHeaders() {
        return {
            'api-key': API_KEY
        };
    }

    function _parser(response) {

        console.log(response);
        return KR.Util.createFeatureCollection([]);
    }

    function getWithin(dataset, latLng, distance, callback, errorCallback, options) {

    }

    function getData(dataset, callback, errorCallback) {

        var url = BASE_URL + '/geography';

        console.log(url);

        KR.Util.sendRequest(url, _parser, callback, errorCallback, _getHeaders());
    }

    return {
        getData: getData
    };
};