import * as _ from 'underscore';

import wtf from 'wtf_wikipedia';

import sendRequest from '../util/sendRequest';
import handleError from '../util/handleError';
import {
    createGeoJSONFeature,
    createFeatureCollection,
    createQueryParameterString
} from '../util';

export default function WikipediaAPI(apiName, options) {
    var MAX_RADIUS = options.maxRadius || 10000;
    var BASE_URL = options.url;
    var urlBase = options.urlBase;
    var BLACKLIST = options.blacklist || [];

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


    function _getWikimediaDetails(pageIds, callback) {

        //this is a bit strange, we use a genrator for extraxts and pageImages,
        //but since the API limits response length we'll have to repeat it
        //see wikiGeneratorQuery
        var params = {
            action: 'query',
            prop: 'revisions',
            rvprop: 'content',
            exlimit: 'max',
            exintro: '',
            pilimit: 'max',
            pageids: pageIds,
            format: 'json',
            'continue': ''
        };
        _wikiGeneratorQuery(params, callback);
    }

    function _getThumbnails(text) {
        const file_reg = new RegExp('{{thumb(.*)}}', 'i');
        var res = text.match(file_reg);
        if (res === null) {
            return [];
        }
        return _.map(_.rest(res), m => {
            var s = m.split('|');
            var filename = s[1].replace(/ /g, '_');

            var year = null;
            var creator = null;
            if (s.length > 3) {
                creator = s[3].replace(/\[/g, '').replace(/\]/g, '');
            }
            if (s.length > 4) {
                year = s[4]
            }

            return {
                type: 'wiki_image',
                description: s[2],
                year: year,
                creator: creator,
                image: `${urlBase}/images/thumb/${encodeURIComponent(filename)}/350px-${encodeURIComponent(filename)}`,
                fullsize: `${urlBase}/images/${encodeURIComponent(filename)}`,
                link: `${urlBase}/wiki/Fil:${encodeURIComponent(filename)}`
            };
        });
    }

    function _getImages(wikiImages) {
        return [];
    }

    function _parseWikimediaItem(item, extra) {
        var extraData = {};
        if (extra && _.has(extra, 'revisions')) {
            var wikitext = extra.revisions[0]['*'];
            var doc = wtf(wikitext);
            extraData.images = _getThumbnails(wikitext).concat(_getImages(doc.images()));
            extraData.thumbnail = extraData.images.length > 0
                ? extraData.images[0].image
                : null;


            var text = _.chain(doc.sections())
                .filter(s => {
                    return BLACKLIST.indexOf(s.title().toLowerCase()) == -1;
                }).map(s => `${s.title()}\n${s.plaintext()}`)
                .value()
                .join('\n\n');

            extraData.text = text;
        }
        var link = `${urlBase}?curid=${item.pageid}`;
        var params = {
            title: item.title,
            link: link,
            id: item.pageid
        };

        return createGeoJSONFeature(
            {lat: item.lat, lng: item.lon},
            _.extend({}, params, extraData),
            apiName + '_' + item.pageid
        );

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
                _getWikimediaDetails(pageIds.join('|'), function (pages) {
                    var features = _.map(response.query.geosearch, function (item) {
                        var extra = _.has(pages, item.pageid)
                            ? pages[item.pageid]
                            : null;
                        return _parseWikimediaItem(item, extra);
                    });
                    callback(createFeatureCollection(features));
                });
            }
        } catch (error) {
            handleError(errorCallback, response.error.info);
        }
    }

    /*
        Get georeferenced Wikipedia articles within a radius of given point.
        Maps data to format similar to norvegiana api.
    */
    function getWithin(query, latLng, distance, callback, errorCallback) {

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
            gslimit: 50
        };
        var url = BASE_URL + '?' + createQueryParameterString(params);
        sendRequest(url, null, function (response) {
            _parseWikimediaItems(response, callback, errorCallback);
        }, errorCallback);
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

    return {
        getWithin: getWithin,
        getData: getData
    };
};
