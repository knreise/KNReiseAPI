import * as _ from 'underscore';

import BrukerbilderAPI from './BrukerbilderAPI';
import sendRequest from '../util/sendRequest';
import {
    createFeatureCollection,
    splitBbox
} from '../util';

export default function BrukerminnerAPI(apiName) {

    var URL_BASE = 'http://beta.ra.no/api/';
    var brukerbilderAPI = BrukerbilderAPI();

    function _toGeom(bbox) {
        var bounds = splitBbox(bbox);
        var ll = bounds.slice(0, 2);
        var ur = bounds.slice(2, 4);
        var coordinates = [[
            ll,
            [ll[0], ur[1]],
            ur,
            [ur[0], ll[1]],
            ll
        ]];
        return {type: 'Polygon', coordinates: coordinates};
    }

    function _acc(url, originalCallback, errorCallback) {
        var data = [];
        return function callback(responseData) {
            data.push(responseData._items);
            if (responseData._links.next) {
                sendRequest(
                    URL_BASE + responseData._links.next.href,
                    null,
                    callback,
                    errorCallback
                );
                return;
            }

            var features = _.reduce(data, function (acc, subFeatures) {
                return acc.concat(subFeatures);
            }, []);
            features = _.map(features, function (feature) {
                feature.id = apiName + '_' + feature._id;
                feature.properties.title = feature.properties.name;
                return feature;
            });
            originalCallback(createFeatureCollection(features));
        };
    }

    function _getAllPages(url, callback, errorCallback) {
        return sendRequest(
            url,
            null,
            _acc(url, callback, errorCallback),
            errorCallback
        );
    }

    function getBbox(dataset, bbox, callback, errorCallback, options) {
        var geom = _toGeom(bbox);
        var query = {'geometry': {'$geoWithin': {'$geometry': geom}}};
        var url = URL_BASE + 'brukerminner?where=' + JSON.stringify(query);
        _getAllPages(url, callback, errorCallback);
    }

    function getItem(dataset, callback, errorCallback) {
        var id = dataset.feature.properties.uri;
        brukerbilderAPI.getImages(id, function(images) {
            callback({media: images});
        }, errorCallback);
    }

    return {
        getBbox: getBbox,
        getItem: getItem
    };
};
