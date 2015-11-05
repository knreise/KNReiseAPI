/*global */

var KR = this.KR || {};

KR.FlickrAPI = function (apiName, options) {
    'use strict';

    var BASE_URL = 'https://api.flickr.com/services/rest/';
    var apikey = options.apikey;

    var imageTemplate = _.template('https://farm<%= farm %>.staticflickr.com/<%= server %>/<%= id %>_<%= secret %>_<%= size %>.jpg');

    function getImageUrl(photo, size) {
        return imageTemplate(_.extend({size: size}, photo));
    }

    function _parser(response, errorCallback) {
        if (response.stat && response.stat === 'fail') {
            KR.Util.handleError(errorCallback, response.message, response);
            return;
        }
        var features = _.chain(response.photos.photo)
            .filter(function (item) {
                var lat = parseFloat(item.latitude);
                var lng = parseFloat(item.longitude);
                return (lat != 0 || lng != 0);
            })
            .map(function (item) {
                var properties = KR.Util.dictWithout(item, 'latitude', 'longitude');

                //see https://www.flickr.com/services/api/misc.urls.html for sizes
                properties.thumbnail = getImageUrl(item, 's');
                properties.image = getImageUrl(item, 'z');
                return KR.Util.createGeoJSONFeature(
                    {
                        lat: parseFloat(item.latitude),
                        lng: parseFloat(item.longitude)
                    },
                    properties,
                    apiName + '_' + item.id
                );
            })
            .value();
        return KR.Util.createFeatureCollection(features);
    }


    function _queryForAllPages(params, callback, errorCallback) {

        var result = [];

        function _gotResponse(response) {
            var fc = _parser(response, errorCallback);
            if (fc && fc.features) {
                result = result.concat(fc.features);
            }

            if (response.photos && response.photos.page < response.photos.pages) {
                params.page = response.photos.page + 1;
                _sendRequest(params)
            } else {
                var fc = KR.Util.createFeatureCollection(result);
                callback(fc);
            }
        }

        function _sendRequest(params) {
            var url = BASE_URL + '?' + KR.Util.createQueryParameterString(params);
            KR.Util.sendRequest(url, _gotResponse);
        }
        _sendRequest(params);
    }


    function _queryFlickr(dataset, params, callback, errorCallback, options) {
        if (!_.has(dataset, 'user_id') && !_.has(dataset, 'group_id')) {
            KR.Util.handleError(errorCallback, 'must specify user_id or group_id');
            return;
        }

        if (_.has(dataset, 'user_id')) {
            params = _.extend(params, {
                method: 'flickr.photos.search',
                user_id: dataset.user_id
            });
        }

        if (_.has(dataset, 'group_id')) {
            params = _.extend(params, {
                method: 'flickr.groups.pools.getPhotos',
                group_id: dataset.group_id
            });
        }

        params = _.extend(params, {
            api_key: apikey,
            has_geo: true,
            per_page: 500,
            extras: 'geo,tags',
            format: 'json',
            nojsoncallback: 1,
            accuracy: dataset.accuracy || 11
        })

        if (_.has(dataset, 'tags')) {
            params.tags = dataset.tags.join(',');
            params.tag_mode = dataset.tag_mode || 'all';
        }
        _queryForAllPages(params, callback, errorCallback);
    }


    function getWithin(dataset, latLng, distance, callback, errorCallback, options) {
        var params = {
            lat: latLng.lat,
            lon: latLng.lng,
            radius: distance / 1000, // convert to km
        };
        _queryFlickr(dataset, params, callback, errorCallback, options);
    }

    function getBbox(dataset, bbox, callback, errorCallback) {
        var params = {
            bbox: bbox
        };
        _queryFlickr(dataset, params, callback, errorCallback, options);
    }

    function getData(dataset, callback, errorCallback) {
        _queryFlickr(dataset, {}, callback, errorCallback, options);
    }

    return {
        getData: getData,
        getWithin: getWithin,
        getBbox: getBbox
    };
};