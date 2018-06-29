import * as _ from 'underscore';

import sendRequest from '../util/sendRequest';
import {
    createGeoJSONFeature,
    createFeatureCollection,
    createQueryParameterString
} from '../util';

export default function JernbanemuseetAPI(apiName, options) {

    var DEFAULT_GROUP = 192;

    function _getGroup(dataset) {
        if (_.has(dataset, 'group')) {
            return dataset.group;
        }
        return DEFAULT_GROUP;
    }

    var lang = options.lang || 'no';

    var BASE_URL = 'https://api.kulturpunkt.org/v2/owners/54';
    var API_KEY = options.apikey;
    function _getHeaders() {
        return {
            'api-key': API_KEY
        };
    }

    function _parser(response) {
        var features = _.map(response.data.records, function (item) {
            var properties = _.extend(item.contents[lang], {id: item.record_id});

            var geom;

            if (_.has(item, 'latitude') && _.has(item, 'longitude')) {
                geom = {
                    lat: item.latitude,
                    lng: item.longitude
                };
            } else if (_.has(item, 'location')) {
                geom = {
                    lat: item.location.latitude,
                    lng: item.location.longitude
                };
            } else {
                console.error('no geometry');
            }
            return createGeoJSONFeature(geom, properties, apiName + '_' + item.record_id);
        });

        return createFeatureCollection(features);
    }

    function _getBlocks(page) {
        return _.map(page.blocks, function (block) {

            if (block.type === 'text') {
                return {
                    text: block.data,
                    type: block.type
                };
            }
            if (block.type === 'image_video' || block.type === 'audio') {
                var media = _.map(block.data, function (data) {
                    var url;
                    if (data.type === 'image') {
                        url = data.url;
                    }
                    if (data.type === 'video') {
                        url = data.url.mp4;
                    }
                    if (data.type === 'audio') {
                        url = data.url.ogg;
                    }

                    var description = '';
                    var title = '';
                    if (_.has(data.contents, lang)) {
                        description = data.contents[lang].description;
                        title = data.contents[lang].title;
                    }
                    return {
                        title: title,
                        description: description,
                        type: data.type,
                        url: url
                    };
                });

                return {
                    media: media,
                    type: block.type
                };
            }
            if (block.type === 'links') {
                return {
                    links: block.data,
                    type: 'links'
                };
            }

        });
    }

    function _parseItem(response) {
        var content = response.data.contents[lang];
        var geom = {
            lat: response.data.location.latitude,
            lng: response.data.location.longitude
        };
        var id = response.data.id;
        var pages = _.map(content.pages, function (page) {
            return {
                title: page.title,
                blocks: _getBlocks(page)
            };
        });

        var images, thumbnail;
        if (response.data.images.length) {
            images = _.pluck(response.data.images, 'url');
            thumbnail = response.data.images[0].thumbnail;
        }

        var properties = {
            license: response.data.license.description,
            id: id,
            thumbnail: thumbnail,
            images: images,
            title: content.title,
            description: content.description,
            pages: pages
        };

        return createGeoJSONFeature(geom, properties, apiName + '_' + id);
    }

    function getItem(dataset, callback, errorCallback) {
        var url = BASE_URL + '/groups/' + _getGroup(dataset) + '/records/' + dataset.id + '?strip_html=true';
        sendRequest(url, _parseItem, callback, errorCallback, _getHeaders());
    }

    function _parseItems(response, callback, errorCallback) {
        var features = _parser(response);

        var completeFeatures = [];
        var finished = _.after(features.features.length, function () {
            callback(createFeatureCollection(completeFeatures));
        });

        _.each(features.features, function (feature) {
            getItem(feature.properties.id, function (newFeature) {
                completeFeatures.push(newFeature);
                finished();
            }, function () {
                finished();
            });
        });
    }

    function getWithin(dataset, latLng, distance, callback, errorCallback, options) {

        var params = {
            'lat': latLng.lat,
            'long': latLng.lng,
            'radius': distance
        };

        var url = BASE_URL + '/groups/' + _getGroup(dataset) + '/nearby?' + createQueryParameterString(params);
        if (options.getDetails) {
            sendRequest(url, null, function (response) {
                _parseItems(response, callback, errorCallback);
            }, null, _getHeaders());
        } else {
            sendRequest(url, _parser, callback, errorCallback, _getHeaders());
        }
    }

    function getData(dataset, callback, errorCallback, options) {
        var url = BASE_URL + '/groups/' + _getGroup(dataset) + '/geography';
        if (options.getDetails) {
            sendRequest(url, null, function (response) {
                _parseItems(response, callback, errorCallback);
            }, null, _getHeaders());
        } else {
            if (dataset.presentation) {
                url = 'https://api.kulturpunkt.org/v2/owners/54/presentations/' + dataset.presentation;
            }
            sendRequest(url, _parser, callback, errorCallback, _getHeaders());
        }
    }

    return {
        getData: getData,
        getWithin: getWithin,
        getItem: getItem
    };
};