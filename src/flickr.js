/*global */

var KR = this.KR || {};

KR.FlickrAPI = function (apikey, apiName) {
    'use strict';

    var BASE_URL = 'https://api.flickr.com/services/rest/';

    var imageTemplate = _.template('https://farm<%= farm %>.staticflickr.com/<%= server %>/<%= id %>_<%= secret %>_<%= size %>.jpg');

    function getImageUrl(photo, size) {
        return imageTemplate(_.extend({size: size}, photo));
    }

    function _parser(response) {
        var features = _.map(response.photos.photo, function (item) {
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
        });
        return KR.Util.createFeatureCollection(features);
    }

    function getWithin(dataset, latLng, distance, callback, errorCallback, options) {
        if (!_.has(dataset, 'user_id')) {
            KR.Util.handleError(errorCallback, 'must specify user_id');
            return;
        }

        var params = {
            method: 'flickr.photos.search',
            user_id: dataset.user_id,
            api_key: apikey,
            lat: latLng.lat,
            lon: latLng.lng,
            radius: distance / 1000, // convert to km
            has_geo: true,
            extras: 'geo,tags',
            format: 'json',
            nojsoncallback: 1
        };

        if (_.has(dataset, 'tags')) {
            params.tags = dataset.tags.join(',');
            params.tag_mode = dataset.tag_mode || 'all';
        }

        var url = BASE_URL + '?' + KR.Util.createQueryParameterString(params);
        KR.Util.sendRequest(url, _parser, callback, errorCallback);
    }

    function getBbox(dataset, bbox, callback, errorCallback) {

        if (!_.has(dataset, 'user_id')) {
            KR.Util.handleError(errorCallback, 'must specify user_id');
            return;
        }

        var params = {
            method: 'flickr.photos.search',
            user_id: dataset.user_id,
            api_key: apikey,
            bbox: bbox,
            has_geo: true,
            extras: 'geo,tags',
            format: 'json',
            nojsoncallback: 1
        };

        if (_.has(dataset, 'tags')) {
            params.tags = dataset.tags.join(',');
            params.tag_mode = dataset.tag_mode || 'all';
        }

        var url = BASE_URL + '?' + KR.Util.createQueryParameterString(params);
        KR.Util.sendRequest(url, _parser, callback, errorCallback);
    }

    return {
        getWithin: getWithin,
        getBbox: getBbox
    };
};