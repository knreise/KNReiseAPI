import * as _ from 'underscore';

import sendRequest from '../util/sendRequest';
import {
    createGeoJSONFeature,
    createFeatureCollection,
    createQueryParameterString,
    splitBbox,
    haversine
} from '../util';


export default function NorvegianaAPI(apiName) {

    var requests = [];

    var BASE_URL = 'http://kulturnett2.delving.org/api/search';
    var BASE_COLLECTION_URL = 'http://acc.norvegiana.delving.org/en/api/knreise-collection/';

    function _formatLatLng(latLng) {
        return latLng.lat + ',' + latLng.lng;
    }

    function _firstOrNull(arr) {
        if (arr && arr.length) {
            return arr[0];
        }
        return null;
    }

    function _parseVideo(link) {
        if (!link) {
            return link;
        }
        if (link.indexOf('www.youtube.com/watch') !== -1) {
            return 'https://www.youtube.com/embed/' + link.substr(link.indexOf('watch?v=') + 8);
        }
        return link;
    }

    function _getProperties(item) {
        return _.chain(item.item.fields)
            .pairs()
            .where(function (field) {
                return field[0] !== 'abm_latLong';
            })
            .reduce(function (acc, field) {
                acc[field[0]] = field[1];
                return acc;
            }, {})
            .value();
    }

    function _fixThumbnail(imageLink) {
        var thumbSize = 75; //px

        if (!imageLink) {
            return imageLink;
        }

        if (imageLink.indexOf('width=') > -1 && imageLink.indexOf('height=') > -1) {
            return imageLink
                .replace(/(width=)(\d+)/g, '$1' + thumbSize)
                .replace(/(height=)(\d+)/g, '$1' + thumbSize);
        }
        return imageLink;
    }

    function _joinArrays(props, keys) {
        return _.chain(keys)
            .reduce(function (acc, key) {

                if (_.has(props, key)) {
                    acc = acc.concat(props[key]);
                }
                return acc;
            }, [])
            .uniq()
            .value();
    }


    function _createMediaList(media) {
        return _.chain(media)
            .map(function (list, type) {
                return _.map(list, function (url) {
                    return {
                        type: type,
                        url: url
                    };
                });
            })
            .flatten()
            .value();
    }


    function _createProperties(allProperties) {

        var thumbUrl = _firstOrNull(allProperties.delving_thumbnail);

        var images = _joinArrays(allProperties, ['delving_thumbnail', 'abm_imageUri']);

        var media = {
            video: _.map(allProperties.abm_videoUri, _parseVideo),
            sound: allProperties.abm_soundUri,
            image: images
        };

        return {
            thumbnail: _fixThumbnail(thumbUrl),
            images: images,
            title: _firstOrNull(allProperties.dc_title),
            content: _.map(allProperties.dc_description, function (d) {
                return '<p>' + d + '</p>';
            }).join('\n'),
            link: _firstOrNull(allProperties.europeana_isShownAt),
            dataset: _firstOrNull(allProperties.europeana_collectionTitle),
            provider: _firstOrNull(allProperties.abm_contentProvider),
            contentType: _firstOrNull(allProperties.europeana_type),
            video: _firstOrNull(allProperties.abm_videoUri),
            videoEmbed: _parseVideo(_firstOrNull(allProperties.abm_videoUri)),
            sound: _firstOrNull(allProperties.abm_soundUri),
            allProps: allProperties,
            media: _createMediaList(media)
        };
    }

    function _parseNorvegianaItem(item) {
        var allProperties = _getProperties(item);

        var properties = _createProperties(allProperties);
        var position = _.map(
            item.item.fields.abm_latLong[0].split(','),
            parseFloat
        );

        var id;
        if (_.has(allProperties, 'delving_hubId')) {
            id = apiName + '_' + allProperties.delving_hubId[0];
        }

        var feature = createGeoJSONFeature(
            {
                lat: position[0],
                lng: position[1]
            },
            properties,
            id
        );
        return feature;
    }

    function _parseNorvegianaItems(response) {
        var nextPage;
        if (response.result.pagination.hasNext) {
            nextPage = response.result.pagination.nextPage;
        }

        var features = _.map(response.result.items, _parseNorvegianaItem);
        var geoJSON = createFeatureCollection(features);
        geoJSON.numFound = response.result.pagination.numFound;
        return {geoJSON: geoJSON, nextPage: nextPage};
    }

    function _acc(url, originalCallback, errorCallback) {
        var data = [];
        return function callback(responseData) {
            data.push(responseData.geoJSON);
            if (responseData.nextPage) {
                sendRequest(
                    url + '&start=' + responseData.nextPage,
                    _parseNorvegianaItems,
                    callback,
                    errorCallback
                );
                return;
            }
            var features = _.reduce(data, function (acc, featureCollection) {
                return acc.concat(featureCollection.features);
            }, []);
            originalCallback(createFeatureCollection(features));
        };
    }

    function _fixDataset(dataset) {
        dataset = _.isArray(dataset)
            ? dataset
            : [dataset];

        return _.map(dataset, function (d) {
            return 'delving_spec:' + d;
        }).join(' OR ');
    }

    function _checkCancel(requestId) {
        if (requests[requestId]) {
            requests[requestId].abort();
            requests[requestId] = null;
        }
    }

    function _getFirstPage(url, callback, errorCallback) {
        return sendRequest(
            url,
            _parseNorvegianaItems,
            function (res) {
                callback(res.geoJSON);
            },
            errorCallback
        );
    }

    function _getAllPages(url, callback, errorCallback) {
        return sendRequest(
            url,
            _parseNorvegianaItems,
            _acc(url, callback, errorCallback),
            errorCallback
        );
    }


    function _get(params, parameters, callback, errorCallback, options) {
        options = _.extend({checkCancel: true}, options || {});
        var dataset = _fixDataset(parameters.dataset);

        params = _.extend({
            query: dataset,
            format: 'json',
            rows: 1000
        }, params);
        params.query += ' delving_hasGeoHash:true';

        var requestId = dataset;
        if (parameters.query) {
            params.qf = parameters.query;
            requestId += parameters.query;
        }
        if (options.checkCancel) {
            _checkCancel(requestId);
        }


        var url = BASE_URL + '?' + createQueryParameterString(params);
        if (options.allPages) {
            requests[requestId] = _getAllPages(url, callback, errorCallback);
        } else {
            requests[requestId] = _getFirstPage(url, callback, errorCallback);
        }
    }

    function getBbox(parameters, bbox, callback, errorCallback, options) {
        bbox = splitBbox(bbox);

        var lng1 = bbox[0],
            lat1 = bbox[1],
            lng2 = bbox[2],
            lat2 = bbox[3];
        var centerLng = (lng1 + lng2) / 2;
        var centerLat = (lat1 + lat2) / 2;

        var radius = _.max([
            haversine(lat2, centerLng, centerLat, centerLng),
            haversine(centerLat, lng1, centerLat, centerLng)
        ]);

        var params = {
            pt: _formatLatLng({lat: centerLat, lng: centerLng}),
            d: radius / 1000, // convert to km
            geoType: 'bbox'
        };
        _get(params, parameters, callback, errorCallback, options);
    }

    function getWithin(parameters, latLng, distance, callback, errorCallback, options) {

        var params = {
            pt: _formatLatLng(latLng),
            d: distance / 1000 // convert to km
        };
        _get(params, parameters, callback, errorCallback, options);
    }

    function getData(parameters, callback, errorCallback, options) {
        if (parameters.query && _.isArray(parameters.query)) {
            var query = 'delving_spec:' + parameters.dataset +
                ' AND (' + parameters.query.join(' OR ') + ')' +
                ' AND delving_hasGeoHash:true';
            var params = {
                query: query,
                format: 'json',
                rows: 1000
            };

            var requestId = query;
            _checkCancel(requestId);

            var url = BASE_URL + '?' + createQueryParameterString(params);
            if (options.allPages) {
                requests[requestId] = _getAllPages(url, callback, errorCallback);
            } else {
                requests[requestId] = _getFirstPage(url, callback, errorCallback);
            }
            return;
        }
        _get({}, parameters, callback, errorCallback, options);
    }

    function getItem(dataset, callback, errorCallback) {
        var params = {
            id: dataset.id,
            format: 'json'
        };
        var url = BASE_URL + '?' + createQueryParameterString(params);
        sendRequest(
            url,
            function (response) {
                return _parseNorvegianaItem(response.result);
            },
            callback,
            errorCallback
        );
    }

    function _collectionParser(data) {

        var features = _.map(data.geo_json.features, function (feature) {
            var properties = _createProperties(feature.properties);
            var id;
            if (_.has(properties.allProps, 'delving_hubId')) {
                id = apiName + '_' + properties.allProps.delving_hubId;
            }
            feature.properties = properties;
            feature.id = id;
            return feature;
        });

        data.geo_json = createFeatureCollection(features);
        return data;
    }

    function getCollection(collectionName, callback, errorCallback) {
        var url = BASE_COLLECTION_URL + collectionName;
        sendRequest(url, _collectionParser, callback, errorCallback);
    }

    return {
        getWithin: getWithin,
        getItem: getItem,
        getBbox: getBbox,
        getData: getData,
        getCollection: getCollection
    };
};
