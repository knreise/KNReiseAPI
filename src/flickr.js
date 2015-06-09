/*global */

var KR = this.KR || {};

KR.FlickrAPI = function (apikey) {
    'use strict';

    var BASE_URL = 'http://crossorigin.me/https://api.flickr.com/services/rest/';

    function _parser(response) {
        response = JSON.parse(response);
        var features = _.map(response.photos.photo, function (item) {
            var properties = KR.Util.dictWithout(item, 'latitude', 'longitude');
            return KR.Util.createGeoJSONFeature(
                {
                    lat: parseFloat(item.latitude),
                    lng: parseFloat(item.longitude)
                },
                properties
            );
        });
        return KR.Util.createFeatureCollection(features);
    }

    function getBbox(dataset, bbox, callback, errorCallback) {
        var params = {
            method: 'flickr.photos.search',
            user_id: dataset.user_id,
            api_key: apikey,
            bbox: bbox,
            has_geo: true,
            extras: 'geo',
            format: 'json',
            nojsoncallback: 1,
            pr_page: 10 //500
        };
        if (dataset.query) {
            params.where = dataset.query;
        }
        var layer = dataset.layer;
        var url = BASE_URL + '?' + KR.Util.createQueryParameterString(params);
        KR.Util.sendRequest(url, _parser, callback, errorCallback);
    }

    return {
        getBbox: getBbox
    };
};