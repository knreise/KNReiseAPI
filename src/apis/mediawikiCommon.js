import * as _ from 'underscore';
import booleanContains from '@turf/boolean-contains';

import sendRequest from '../util/sendRequest';
import handleError from '../util/handleError';
import {
    createGeoJSONFeature,
    createQueryParameterString,
    haversine,
    splitBbox
} from '../util';


function toRadius(bbox) {
    bbox = splitBbox(bbox);

    var lng1 = bbox[0],
        lat1 = bbox[1],
        lng2 = bbox[2],
        lat2 = bbox[3];

    var centerLng = (lng1 + lng2) / 2;
    var centerLat = (lat1 + lat2) / 2;

    var radius = _.max([
        haversine(lat1, lng1, centerLat, centerLng),
        haversine(lat2, lng2, centerLat, centerLng)
    ]);

    return {lat: centerLat, lng: centerLng, radius: radius};
}

function toPoly(bbox) {
    bbox = splitBbox(bbox);
    var minLon = bbox[0];
    var minLat = bbox[1];
    var maxLon = bbox[2];
    var maxLat = bbox[3];
    return {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'Polygon',
            coordinates: [[
                [minLon, minLat], //se
                [maxLon, minLat], //sw
                [maxLon, maxLat], //nw
                [minLon, maxLat], //ne
                [minLon, minLat] //se
            ]]
        }
    };
}



function getWithinRadius(latLng, distance, baseUrl, maxRadius, callback, errorCallback) {

    if (distance > maxRadius) {
        handleError(errorCallback, 'too wide search radius: ' + distance + ' (max is ' + maxRadius + 'm)');
        return;
    }

    var params = {
        action: 'query',
        list: 'geosearch',
        gsradius: distance,
        gscoord: latLng.lat + '|' + latLng.lng,
        format: 'json',
        gslimit: 500
    };
    var url = baseUrl + '?' + createQueryParameterString(params);
    sendRequest(url, null, callback, errorCallback);
}


function _filterItems(response, bbox) {
    try {
        response = JSON.parse(response);
    } catch (ignore) {}

    var boundsPoly = toPoly(bbox);

    var filtered = _.chain(response.query.geosearch)
        .map(function (item) {
            return createGeoJSONFeature(
                {lat: item.lat, lng: item.lon},
                {item: item}
            );
        })
        .filter(function (feature) {
            return booleanContains(boundsPoly, feature);
        })
        .map(function (feature) {
            return feature.properties.item;
        })
        .value();

    return {
        query: {
            geosearch: filtered
        }
    };
}

function wikiQuery(baseUrl, params, callback) {
    var url = baseUrl + '?' + createQueryParameterString(params);
    sendRequest(url, null, function (response) {
        try {
            response = JSON.parse(response);
        } catch (ignore) {}
        callback(response);
    });
}


export function createGetBbox(parser, baseUrl, maxRadius) {
    return function getBbox(dataset, bbox, callback, errorCallback) {
        var radiusData = toRadius(bbox);
        var radius = radiusData.radius;
        getWithinRadius(radiusData, radius, baseUrl, maxRadius, function (response) {
            response = _filterItems(response, bbox);
            parser(response, callback, errorCallback);
        }, errorCallback);
    };
}

export function createGetWithin(parser, baseUrl, maxRadius) {
    return function getWithin(query, latLng, radius, callback, errorCallback) {
        getWithinRadius(latLng, radius, baseUrl, maxRadius, function (response) {
            parser(response, callback, errorCallback);
        }, errorCallback);
    };
}



export function wikiGeneratorQuery(baseUrl, params, finishedCallback) {

    //the final storage of alle extraData
    var pages = {};

    function gotResponse(response) {

        //store data: the API returns all pageIds for each request,
        //but only sets the requested generator attributes on some
        _.each(response.query.pages, function (page, key) {
            if (_.has(pages, key)) {
                pages[key] = _.extend(pages[key], page);
            } else {
                pages[key] = page;
            }
        });

        //handle the continue flags
        if (_.has(response, 'continue')) {
            var cont = {};
            if (_.has(response['continue'], 'picontinue')) {
                cont.picontinue = response['continue'].picontinue;
            }
            if (_.has(response['continue'], 'excontinue')) {
                cont.excontinue = response['continue'].excontinue;
            }

            //if api had "continue", we do so using recursion
            var newparams = _.extend(cont, params);
            wikiQuery(baseUrl, newparams, gotResponse);
        } else {
            finishedCallback(pages);
        }

    }
    wikiQuery(baseUrl, params, gotResponse);
}


/*

function getWithin(query, latLng, distance, callback, errorCallback) {
    _getRadius(latLng, distance, function (response) {
        _parseWikimediaItems(response, callback, errorCallback);
    }, errorCallback);
}

function getData(parameters, callback, errorCallback, options) {
    var params = {
        'action': 'query',
        'generator': 'categorymembers',
        'gcmtitle': 'Kategori:' + parameters.category,
        'prop': 'coordinates',
        'format': 'json'
    };

    var result = [];
    function sendRequest(cont) {
        var mergedParams = _.extend({}, params, cont);
        var url = BASE_URL + '?' + createQueryParameterString(mergedParams);
        sendRequest(url, null, function (response) {
            result.push(response.query.pages);
            if (_.has(response, 'continue')) {
                sendRequest(response['continue']);
            } else {
                callback(_parseCategoryResult(result));
            }
        }, errorCallback);
    }
    sendRequest({'continue': ''});
}


function getItem(dataset, callback, errorCallback) {
    var params = {
        'action': 'query',
        'pageids': dataset.id,
        'prop': 'coordinates|pageimages|extracts',
        'format': 'json'
    };
    var url = BASE_URL + '?' + createQueryParameterString(params);
    sendRequest(url, function (res) {
        return _parseWikimediaItem(res.query.pages[dataset.id]);
    }, callback, errorCallback);
}
*/