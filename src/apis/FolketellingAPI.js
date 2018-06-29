import * as _ from 'underscore';

import sendRequest from '../util/sendRequest';
import handleError from '../util/handleError';
import {
    createGeoJSONFeature,
    createFeatureCollection,
    createQueryParameterString,
    dictWithout
} from '../util';

export default function FolketellingAPI(apiName) {

    var BASE_URL = 'http://api.digitalarkivet.arkivverket.no/v1/census/1910/';

    var MAX_RADIUS = 5000;

    function _parser(response) {
        var features = _.map(response.results, function (item) {
            var properties = dictWithout(item, 'latitude', 'longitude');
            var geom = {
                lat: parseFloat(item.latitude),
                lng: parseFloat(item.longitude)
            };
            return createGeoJSONFeature(geom, properties, apiName + '_' + item.autoid);
        });
        return createFeatureCollection(features);
    }

    function getWithin(dataset, latLng, distance, callback, errorCallback, options) {
        var limit = dataset.limit || 1000;

        if (dataset.dataset !== 'property') {
            handleError(errorCallback, 'unknown dataset ' + dataset.dataset);
            return;
        }

        if (distance > MAX_RADIUS) {
            handleError(errorCallback, 'too wide search radius: ' + distance + ' (max is ' + MAX_RADIUS + 'm)');
            return;
        }
        var params = {
            latitude: latLng.lat,
            longitude: latLng.lng,
            precision: distance,
            limit: limit
        };

        var url = BASE_URL + 'search_property_geo?' + createQueryParameterString(params);
        sendRequest(url, _parser, callback, errorCallback);
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
                sendRequest(url, null, function (response) {
                    _propertyParserWithPersons(response, callback, errorCallback);
                }, errorCallback);
            } else {
                sendRequest(url, _propertyParser, callback, errorCallback);
            }
        } else if (dataset.type === 'apartmentData' && dataset.apartmentId) {
            url = BASE_URL + 'property/' + dataset.apartmentId;
            sendRequest(url, null, callback, errorCallback);
        } else {
            handleError(errorCallback, 'Not enough parameters');
        }
    }

    return {
        getData: getData,
        getWithin: getWithin
    };
};
