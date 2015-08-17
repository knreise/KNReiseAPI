/*global L:false, esri2geo: false*/

var KR = this.KR || {};

KR.FolketellingAPI = function (apiName) {
    'use strict';

    var BASE_URL = 'http://api.digitalarkivet.arkivverket.no/v1/census/1910/';

    var MAX_DISTANCE = 5000;

    function _parser(response) {
        var features = _.map(response.results, function (item) {
            var properties = KR.Util.dictWithout(item, 'latitude', 'longitude');
            var geom = {
                lat: parseFloat(item.latitude),
                lng: parseFloat(item.longitude)
            };
            return KR.Util.createGeoJSONFeature(geom, properties, apiName + '_' + item.autoid);
        });
        return KR.Util.createFeatureCollection(features);
    }

    function getWithin(dataset, latLng, distance, callback, errorCallback, options) {
        var limit = dataset.limit || 1000;

        if (dataset.dataset !== 'property') {
            KR.Util.handleError(errorCallback, 'unknown dataset ' + dataset.dataset);
            return;
        }

        if (distance > MAX_DISTANCE) {
            KR.Util.handleError(errorCallback, 'to wide search radius');
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

    function _propertyParserWithPersons(res, callback, errorCallback) {
        if (res.property.id.indexOf('gf') === 0) {
            if (!res.apartments) {
                res.apartments = null;
                callback({properties: res});
                return;
            }
            var apartments = [];

            var finished = _.after(res.apartments.length, function () {
                res.apartments = apartments;
                callback({properties: res});
            });

            _.each(res.apartments, function (apartment) {
                getData(
                    {
                        type: 'apartmentData',
                        apartmentId: apartment.id
                    },
                    function (apartmentData) {
                        apartments.push(apartmentData);
                        finished();
                    }
                );
            });
            return;
        }

        callback({properties: res});
        return;
    }

    function _propertyParser(res) {
        if (!res.apartments) {
            res.apartments = null;
        }
        return {properties: res};
    }

    function getData(dataset, callback, errorCallback, options) {
        var url;
        if (dataset.type === 'propertyData' && dataset.propertyId) {
            url = BASE_URL + 'property/' + dataset.propertyId;
            if (dataset.withPersons) {
                KR.Util.sendRequest(url, null, function (response) {
                    _propertyParserWithPersons(response, callback, errorCallback);
                }, errorCallback);
            } else {
                KR.Util.sendRequest(url, _propertyParser, callback, errorCallback);
            }
        } else if (dataset.type === 'apartmentData' && dataset.apartmentId) {
            url = BASE_URL + 'property/' + dataset.apartmentId;
            KR.Util.sendRequest(url, null, callback, errorCallback);
        } else {
            KR.Util.handleError(errorCallback, 'Not enough parameters');
        }
    }

    return {
        getData: getData,
        getWithin: getWithin
    };
};
