/*global L:false, esri2geo: false*/

var KR = this.KR || {};

KR.FolketellingAPI = function () {
    'use strict';

    var BASE_URL = 'http://api.digitalarkivet.arkivverket.no/v1/census/1910/';

    var MAX_DISTANCE = 5000;

    function _dictWithout(dict) {
        var keys = _.without(_.keys(dict), Array.prototype.slice.call(arguments, 1));
        return _.reduce(keys, function (acc, key) {
            acc[key] = dict[key];
            return acc;
        }, {});
    }

    function _err(errorCallback, error) {
        if (errorCallback) {
            errorCallback({'error': error});
            return;
        }
        throw new Error(error);
    }

    function _parser(response) {
        var features = _.map(response.results, function (item) {
            var properties = _dictWithout(item, 'latitude', 'longitude');
            return KR.Util.createGeoJSONFeature({lat: item.latitude, lng: item.longitude}, properties);
        });
        return KR.Util.createFeatureCollection(features);
    }

    function getWithin(dataset, latLng, distance, callback, errorCallback, options) {
        var limit = dataset.limit || 1000;

        if (dataset.dataset !== 'property') {
            _err(errorCallback, 'unknown dataset ' + dataset.dataset);
            return;
        }

        if (distance > MAX_DISTANCE) {
            _err(errorCallback, 'to wide search radius');
            return;
        }
        var params = {
            latitude: latLng.lat,
            longitude: latLng.lng,
            precision: distance,
            limit: limit
        };

        var url = BASE_URL +  'search_property_geo?' + KR.Util.createQueryParameterString(params);
        KR.Util.sendRequest(url, _parser, callback, errorCallback);
    }

    return {
        getWithin: getWithin
    };
};