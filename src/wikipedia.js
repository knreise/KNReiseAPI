/*global CryptoJS:false */

var KR = this.KR || {};

KR.WikipediaAPI = function (BASE_URL, MAX_RADIUS, linkBase, apiName) {
    'use strict';
    MAX_RADIUS = MAX_RADIUS || 10000;

    function _wikiquery(params, callback) {
        var url = BASE_URL + '?'  + KR.Util.createQueryParameterString(params);
        KR.Util.sendRequest(url, null, function (response) {
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
            contentType: 'TEXT'
        };
        return KR.Util.createGeoJSONFeature(
            {lat: item.lat, lng: item.lon},
            params,
            apiName + '_' + link
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
                callback(KR.Util.createFeatureCollection([]));
            } else {
                _getWikimediaDetails(pageIds.join('|'), function (pages) {
                    var features = _.map(response.query.geosearch, function (item) {
                        return _parseWikimediaItem(item, pages);
                    });
                    callback(KR.Util.createFeatureCollection(features));
                });
            }
        } catch (error) {
            KR.Util.handleError(errorCallback, response.error.info);
        }
    }

    /*
        Get georeferenced Wikipedia articles within a radius of given point.
        Maps data to format similar to norvegiana api.
    */
    function getWithin(query, latLng, distance, callback, errorCallback) {

        if (distance > MAX_RADIUS) {
            KR.Util.handleError(errorCallback, 'to wide search radius (max is ' + MAX_RADIUS + ')');
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
        var url = BASE_URL + '?'  + KR.Util.createQueryParameterString(params);
        KR.Util.sendRequest(url, null, function (response) {
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
        return KR.Util.createFeatureCollection(features);
    }


    function getData(parameters, callback, errorCallback, options) {
        var params = {
            'action': 'query',
            'generator': 'categorymembers',
            'gcmtitle': 'Kategori:' + parameters.category,
            'prop': 'coordinates|pageimages|extracts',
            'format': 'json'
        };

        var result = [];
        function sendRequest(cont) {
            var mergedParams = _.extend({}, params, cont);
            var url = BASE_URL + '?'  + KR.Util.createQueryParameterString(mergedParams);
            KR.Util.sendRequest(url, null, function (response) {
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
