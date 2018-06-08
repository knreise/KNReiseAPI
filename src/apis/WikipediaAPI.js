import * as _ from 'underscore';
import CryptoJS from 'crypto-js';
import booleanContains from '@turf/boolean-contains';

import sendRequest from '../util/sendRequest';
import handleError from '../util/handleError';
import {
    createGeoJSONFeature,
    createFeatureCollection,
    createQueryParameterString,
    haversine,
    splitBbox
} from '../util';

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


export default function WikipediaAPI(apiName, options) {
    var MAX_RADIUS = options.maxRadius || 10000;
    var BASE_URL = options.url;
    var linkBase = options.linkBase;

    function _wikiquery(params, callback) {
        var url = BASE_URL + '?' + createQueryParameterString(params);
        sendRequest(url, null, function (response) {
            try {
                response = JSON.parse(response);
            } catch (ignore) {}
            callback(response);
        });
    }

    function _wikiGeneratorQuery(params, finishedCallback) {

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
                _wikiquery(newparams, gotResponse);
            } else {
                finishedCallback(pages);
            }

        }
        _wikiquery(params, gotResponse);
    }

    function _getWikimediaImageUrl(filename) {
        var base = 'http://upload.wikimedia.org/wikipedia/commons/';
        var hash = CryptoJS.MD5(filename).toString();
        return base + hash.substr(0, 1) + '/' + hash.substr(0, 2) + '/' + filename;
    }

    function _getWikimediaDetails(pageIds, callback) {

        //this is a bit strange, we use a genrator for extraxts and pageImages,
        //but since the API limits response length we'll have to repeat it
        //see wikiGeneratorQuery
        var params = {
            action: 'query',
            prop: 'extracts|pageimages',
            exlimit: 'max',
            exintro: '',
            pilimit: 'max',
            pageids: pageIds,
            format: 'json',
            'continue': ''
        };
        _wikiGeneratorQuery(params, callback);
    }

    function _parseWikimediaItem(item, extdaDataDict) {
        extdaDataDict = extdaDataDict || {};
        var extraData = extdaDataDict[item.pageid];
        if (extraData) {
            item = _.extend(item, extraData);
        }

        var thumbnail;
        if (_.has(item, 'thumbnail')) {
            thumbnail = item.thumbnail.source;
        }

        var images = null;
        if (item.pageimage) {
            images = [_getWikimediaImageUrl(item.pageimage)];
        }
        var link = linkBase + item.pageid;
        var params = {
            thumbnail: thumbnail,
            images: images,
            title: item.title,
            content: item.extract,
            link: link,
            dataset: 'Wikipedia',
            provider: 'Wikipedia',
            contentType: 'TEXT',
            id: item.pageid
        };
        return createGeoJSONFeature(
            {lat: item.lat, lng: item.lon},
            params,
            apiName + '_' + item.pageid
        );
    }

    function chunk(arr, len) {

        var chunks = [],
            i = 0,
            n = arr.length;

        while (i < n) {
            chunks.push(arr.slice(i, i += len));
        }
      return chunks;
    }

    function _parseWikimediaItems(response, callback, errorCallback) {
        try {
            response = JSON.parse(response);
        } catch (ignore) {}


        try {
            //since the wikipedia API does not include details, we have to ask for 
            //them seperately (based on page id), and then join them
            var pageIds = _.pluck(response.query.geosearch, 'pageid');

            if (!pageIds.length) {
                callback(createFeatureCollection([]));
            } else {
                var chunks = chunk(pageIds, 50);

                var res = {};
                var finished = _.after(chunks.length, function () {
                    var features = _.map(response.query.geosearch, function (item) {
                        return _parseWikimediaItem(item, res);
                    });
                    callback(createFeatureCollection(features));
                });

                _.each(chunks, function (pageIds) {
                    _getWikimediaDetails(pageIds.join('|'), function (pages) {
                        _.extend(res, pages);
                        finished();
                    });
                });

            }
        } catch (error) {
            handleError(errorCallback, response.error.info);
        }
    }



    function _parseCategoryResult(results) {

        var features = _.chain(results)
            .reduce(function (acc, dict) {
                _.each(dict, function (parameters, key) {
                    if (_.has(acc, key)) {
                        acc[key] = _.extend(acc[key], parameters);
                    } else {
                        acc[key] = parameters;
                    }
                });

                return acc;
            }, {})
            .filter(function (item) {
                return _.has(item, 'coordinates');
            }).map(function (item) {
                item.lat = item.coordinates[0].lat;
                item.lon = item.coordinates[0].lon;
                return item;
            })
            .map(_parseWikimediaItem)
            .value();
        return createFeatureCollection(features);
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


    function _getRadius(latLng, distance, callback, errorCallback) {

        if (distance > MAX_RADIUS) {
            handleError(errorCallback, 'too wide search radius: ' + distance + ' (max is ' + MAX_RADIUS + 'm)');
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
        var url = BASE_URL + '?' + createQueryParameterString(params);
        sendRequest(url, null, callback, errorCallback);
    }


    /*
        Get georeferenced Wikipedia articles within a radius of given point.
        Maps data to format similar to norvegiana api.
    */
    function getWithin(query, latLng, distance, callback, errorCallback) {
        _getRadius(latLng, distance, function (response) {
            _parseWikimediaItems(response, callback, errorCallback);
        }, errorCallback);
    }

    function getBbox(dataset, bbox, callback, errorCallback) {
        var radiusData = toRadius(bbox);
        var radius = radiusData.radius;
        _getRadius(radiusData, radius, function (response) {
            response = _filterItems(response, bbox);
            _parseWikimediaItems(response, callback, errorCallback);
        }, errorCallback);

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

    return {
        getWithin: getWithin,
        getData: getData,
        getItem: getItem,
        getBbox: getBbox
    };
};
