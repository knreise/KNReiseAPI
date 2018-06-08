import * as _ from 'underscore';
import CryptoJS from 'crypto-js';

import handleError from '../util/handleError';
import sendRequest from '../util/sendRequest';
import {
    createFeatureCollection,
    createGeoJSONFeature,
    createQueryParameterString
} from '../util';

import {
    createGetBbox,
    createGetWithin,
    wikiGeneratorQuery
} from './mediawikiCommon';

export default function WikipediaAPI(apiName, options) {
    var MAX_RADIUS = options.maxRadius || 10000;
    var BASE_URL = options.url;
    var linkBase = options.linkBase;



    function createChunks(arr, len) {
        var chunks = [],
            i = 0,
            n = arr.length;

        while (i < n) {
            chunks.push(arr.slice(i, i += len));
        }
      return chunks;
    }

    function getWikipediaImageUrl(filename) {
        var base = 'http://upload.wikimedia.org/wikipedia/commons/';
        var hash = CryptoJS.MD5(filename).toString();
        return base + hash.substr(0, 1) + '/' + hash.substr(0, 2) + '/' + filename;
    }

    function getWikipediaDetails(pageIds, callback) {

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
        wikiGeneratorQuery(BASE_URL, params, callback);
    }

    function parseWikipediaItems(response, callback, errorCallback) {
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
                var chunks = createChunks(pageIds, 50);

                var res = {};
                var finished = _.after(chunks.length, function () {
                    var features = _.map(response.query.geosearch, function (item) {
                        return parseWikipediaItem(item, res);
                    });
                    callback(createFeatureCollection(features));
                });

                _.each(chunks, function (pageIds) {
                    getWikipediaDetails(pageIds.join('|'), function (pages) {
                        _.extend(res, pages);
                        finished();
                    });
                });

            }
        } catch (error) {
            handleError(errorCallback, response.error.info);
        }
    }

    function parseWikipediaItem(item, extdaDataDict) {
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
        if (_.has(item, 'pageimage')) {
            images = [getWikipediaImageUrl(item.pageimage)];
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

    function parseCategoryResult(results) {

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
            .map(parseWikipediaItem)
            .value();
        return createFeatureCollection(features);
    }


    var getBbox = createGetBbox(parseWikipediaItems, BASE_URL, MAX_RADIUS);
    var getWithin = createGetWithin(parseWikipediaItems, BASE_URL, MAX_RADIUS);

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
                    callback(parseCategoryResult(result));
                }
            }, errorCallback);
        }
        sendRequest({'continue': ''});
    }

    return {
        getBbox: getBbox,
        getWithin: getWithin,
        getData: getData
    };
};
