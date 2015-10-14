/*global L:false, esri2geo: false*/

var KR = this.KR || {};

KR.ArcgisAPI = function (apiName, options) {
    'use strict';
    var BASE_URL = options.url;

    function _parseBbox(bbox) {
        bbox = KR.Util.splitBbox(bbox);
        return JSON.stringify({
            'xmin': bbox[0],
            'ymin': bbox[1],
            'xmax': bbox[2],
            'ymax': bbox[3]
        });
    }


    function _mapExtraData(features, extraDataResponse, dataset) {
        extraDataResponse = JSON.parse(extraDataResponse);
        var extra = extraDataResponse.features;
        var newFeatures = _.map(features.features, function (feature) {
            var extraProperties = _.find(extra, function (item) {
                return item.attributes[dataset.matchId] === feature.properties[dataset.matchId];
            });

            if (extraProperties) {
                extraProperties = extraProperties.attributes;
                feature.properties.thumbnail = extraProperties.UrlTilBilde;
            }

            var properties = _.extend(
                feature.properties,
                {extra: extraProperties}
            );
            return KR.Util.createGeoJSONFeatureFromGeom(
                feature.geometry,
                properties,
                feature.id
            );
        });
        return KR.Util.createFeatureCollection(newFeatures);
    }


    function _getExtraData(features, dataset, callback, errorCallback) {
        var ids = _.map(features.features, function (feature) {
            return feature.properties[dataset.matchId];
        });

        var params = {
            where: dataset.matchId + ' IN (' + ids.join(',') + ')',
            outFields: '*',
            returnGeometry: false,
            returnIdsOnly: false,
            returnCountOnly: false,
            returnZ: false,
            returnM: false,
            returnDistinctValues: false,
            f: 'pjson',
        };

        var url = BASE_URL + dataset.extraDataLayer + '/query?'  + KR.Util.createQueryParameterString(params);
        KR.Util.sendRequest(url, null, function (response) {
            console.log(response);
            callback(_mapExtraData(features, response, dataset));
        }, errorCallback);
    }

    function _parseArcGisResponse(response, callback, errorCallback, dataset) {
        try {
            response = JSON.parse(response);
        } catch (ignore) {}
        if (_.has(response, 'error')) {
            KR.Util.handleError(errorCallback, response.error.message);
            return;
        }

        esri2geo.toGeoJSON(response, function (err, data) {
            if (!err) {
                _.each(data.features, function (feature) {
                    if (_.has(feature.properties, 'Navn')) {
                        feature.properties.title = feature.properties.Navn;
                    }
                    feature.id = apiName + '_' + feature.properties.OBJECTID;
                });
                if (dataset.getExtraData) {
                    _getExtraData(data, dataset, callback, errorCallback);
                } else {
                    callback(data);
                }
            } else {
                callback(KR.Util.createFeatureCollection([]));
            }
        });
    }

    function getBbox(dataset, bbox, callback, errorCallback) {
        var params = {
            'geometry': _parseBbox(bbox),
            'geometryType': 'esriGeometryEnvelope',
            'inSR': 4326,
            'spatialRel': 'esriSpatialRelIntersects',
            'outFields': '*',
            'returnGeometry': true,
            'outSR': 4326,
            'returnIdsOnly': false,
            'returnCountOnly': false,
            'outStatistics': '',
            'returnZ': false,
            'returnM': false,
            'returnDistinctValues': false,
            'f': 'json'
        };
        if (dataset.query) {
            params.where = dataset.query;
        }
        var layer = dataset.layer;
        var url = BASE_URL + layer + '/query' +  '?'  + KR.Util.createQueryParameterString(params);
        KR.Util.sendRequest(url, null, function (response) {
            _parseArcGisResponse(response, callback, errorCallback, dataset);
        }, errorCallback);
    }

    return {
        getBbox: getBbox
    };
};
