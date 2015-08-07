/*global L: false */

var KR = this.KR || {};
KR.Util = {};

(function (ns) {
    'use strict';


    /*
        Takes a dictionary and a keys, returns a dict without the keys
    */
    ns.dictWithout = function (dict) {
        var keys = _.without(_.keys(dict), Array.prototype.slice.call(arguments, 1));
        return _.reduce(keys, function (acc, key) {
            acc[key] = dict[key];
            return acc;
        }, {});
    };


    /*
        Creates a urlescaped query parameter string based on a dict
    */
    ns.createQueryParameterString = function (params) {
        return _.map(params, function (value, key) {
            return encodeURIComponent(key) + '=' + encodeURIComponent(value);
        }).join('&');
    };


    /*
        Handles an error, either by calling a callback or throwing an Error
    */
    ns.handleError = function (errorCallback, error, data) {
        if (errorCallback) {
            errorCallback({'error': error, 'data': data});
            return;
        }
        throw new Error(error);
    };


    /*
        Sends a GET-request, optionally runs the result through a parser and 
        calls a callback
    */
    ns.sendRequest = function (url, parser, callback, errorCallback, headers) {
        headers = headers || {};
        return $.ajax({
            type: 'get',
            beforeSend: function (request){
                _.each(headers, function (value, key) {
                    request.setRequestHeader(key, value);
                });
            },
            url: url,
            success: function (response) {
                if (parser) {
                    var parsed;
                    try {
                        parsed = parser(response, errorCallback);
                    } catch (e) {
                        ns.handleError(errorCallback, e.message, response);
                        return;
                    }
                    if (!_.isUndefined(parsed)) {
                        callback(parsed);
                    }
                } else {
                    callback(response);
                }
            },
            error: errorCallback
        });
    };


    /*
        Creates a GeoJSON feature from a L.LatLng and optionally a properties dict
    */
    ns.createGeoJSONFeature = function (latLng, properties) {
        properties = properties || {};
        return {
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': [latLng.lng, latLng.lat]
            },
            'properties': properties
        };
    };

    /*
        Creates a GeoJSON feature from a GeoJSON Geometry and optionally a properties dict
    */
    ns.createGeoJSONFeatureFromGeom = function (geom, properties) {
        properties = properties || {};
        return {
            'type': 'Feature',
            'geometry': geom,
            'properties': properties
        };
    };


    /*
        GeoJSON FeatureCollection from an array of GeoJSON features
    */
    ns.createFeatureCollection = function (features) {
        return {
            'type': 'FeatureCollection',
            'features': features
        };
    };

    ns.stamp = (function () {
        var lastId = 0,
            key = '_knreise_id';
        return function (obj) {
            obj[key] = obj[key] || ++lastId;
            return obj[key];
        };
    }());

    function _toRad(value) {
        return value * Math.PI / 180;
    }


    /*
        Calculates the Haversine distance between two points
    */
    ns.haversine = function (lat1, lon1, lat2, lon2) {
        var R = 6371000; // metres
        var phi1 = _toRad(lat1);
        var phi2 = _toRad(lat2);
        var bDeltaPhi = _toRad(lat2 - lat1);
        var bDeltaDelta = _toRad(lon2 - lon1);

        var a = Math.sin(bDeltaPhi / 2) * Math.sin(bDeltaPhi / 2) +
                Math.cos(phi1) * Math.cos(phi2) *
                Math.sin(bDeltaDelta / 2) * Math.sin(bDeltaDelta / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };


    /*
        Split a bbox-string to an array
    */
    ns.splitBbox = function (bbox) {
        return bbox.split(',').map(parseFloat);
    };

}(KR.Util));
