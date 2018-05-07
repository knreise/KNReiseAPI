import * as _ from 'underscore';
import ArcgisAPI from './ArcgisAPI';
import sendRequest from '../util/sendRequest';
import handleError from '../util/handleError';
import Mapper from '../mappings';
import {
    createQueryParameterString
} from '../util';
import BrukerbilderAPI from './BrukerbilderAPI';

export default function KulturminneAPI(apiName) {

    var mapData = Mapper(apiName);
    var brukerbilderAPI = BrukerbilderAPI();

    var API_URL = 'http://kd-miniproxy.ra.no/miniProxy.php/http://kart.ra.no/arcgis/rest/services/Distribusjon/Kulturminner/MapServer/';
    //var API_URL = 'https://kart.ra.no/arcgis/rest/services/Distribusjon/Kulturminner/MapServer/';
    var IMAGE_API_BASE = 'https://kulturminnebilder.ra.no';

    var baseAPI = ArcgisAPI(
        'kulturminne',
        {
            url: API_URL,
            idProp: 'ObjectID'
        }
    );

    var types = {
        enkeltminner: {
            layer: 4,
            photoId: 'KulturminneID',
            descriptionId: 'KulturminneID',
            descriptionLayer: 8,
            descriptionFields: ['Beskrivelse']
        },
        lokaliteter: {
            layer: 5,
            photoId: 'LokalitetID',
            userPhotoId: 'LokalitetID',
            subLayerId: 'LokalitetID',
            descriptionId: 'LokalitetID',
            descriptionLayer: 10,
            descriptionFields: ['Beskrivelse', 'Kulturminnesok'],
            subLayerFunc: _getEnkeltminner,
            userPhotoIdTemplate: _.template('https://data.kulturminne.no/askeladden/lokalitet/<%= id %>')
        },
        kulturmiljoer: {
            layer: 7,
            photoId: 'KulturmiljoID',
            userPhotoId: 'KulturmiljoID',
            descriptionId: 'KulturmiljoID',
            descriptionLayer: 9,
            descriptionFields: ['Beskrivelse', 'Beskrivelse2'],
            photoIdTemplate: _.template('K<%= id %>'),
            userPhotoIdTemplate: _.template('https://data.kulturminne.no/askeladden/kulturmiljo/K<%= id %>')
        }
    };

    function _getDataset(dataset, errorCallback) {
        if (! _.has(types, dataset.dataset)) {
            handleError(errorCallback, 'Unknown dataset ' + dataset.dataset);
        }
        return _.extend({}, dataset, types[dataset.dataset]);
    }

    function _parseEnkeltminer(response) {
        return response;
    }

    function _getEnkeltminner(key, id, callback, errorCallback) {
        var layer = types.enkeltminner.layer;
        var query = key + ' IN (' + id + ')';
        baseAPI.getSubLayer(query, layer, _parseEnkeltminer, true, function (response) {
            baseAPI.parseArcGisResponse(response, function (data) {
                mapData(data, {api: apiName, dataset: 'enkeltminner'}, function (err, data) {
                    if (err) {
                        errorCallback(err);
                        return;
                    }
                    callback(data);
                });

            }, errorCallback);
        }, errorCallback);
    }


    function getBbox(dataset, bbox, callback, errorCallback) {
        var parsedDataset = _getDataset(dataset);
        if (!parsedDataset) {
            return;
        }
        baseAPI.getBbox(parsedDataset, bbox, function (data) {
            mapData(data, parsedDataset, function (err, data) {
                if (err) {
                    errorCallback(err);
                    return;
                }
                callback(data);
            });
        }, errorCallback);
    }

    function _parseItem(data, callback) {
        return {
            media: _.map(data.data, function (data) {
                var image = _.findWhere(data.previews, {size: 400});
                return {
                    type: 'fotoweb_image',
                    href: IMAGE_API_BASE + data.href,
                    creator: _.has(data.metadata, '116') ? data.metadata['116'].value : null,
                    license: _.has(data.metadata, '315') ? data.metadata['315'].value : null,
                    image: IMAGE_API_BASE + image.href
                };
            })
        };
    }

    function getItemImage(dataset, callback, errorCallback) {
        var parsedDataset = _getDataset(dataset);
        if (!parsedDataset) {
            errorCallback('invalid dataset');
        }

        var id = dataset.feature.properties[parsedDataset.photoId];
        if (parsedDataset.photoIdTemplate) {
            id = parsedDataset.photoIdTemplate({id: id});
        }

        var url = IMAGE_API_BASE + '/fotoweb/archives/5001-Alle%20kulturminnebilder/?212=' + id;
        return sendRequest(
            url,
            _parseItem,
            callback,
            errorCallback,
            {'Accept': 'application/vnd.fotoware.assetlist+json'}
        );
    }

    function getItemUserImage(dataset, callback, errorCallback) {
        var parsedDataset = _getDataset(dataset);
        if (!parsedDataset) {
            errorCallback('invalid dataset');
        }
        if (!parsedDataset.userPhotoId) {
            callback({});
            return;
        }
        var id = dataset.feature.properties[parsedDataset.userPhotoId];
        if (parsedDataset.userPhotoIdTemplate) {
            id = parsedDataset.userPhotoIdTemplate({id: id});
        }
        brukerbilderAPI.getImages(id, function(images) {
            callback({media: images});
        }, errorCallback);
    }

    function getQuery(name, value) {

        var escapedValue = _.isString(value)
            ? '\'' + value + '\''
            : value;

        return name + ' IN (' + escapedValue + ')';
    }

    function getItemDescription(dataset, callback, errorCallback) {
        var parsedDataset = _getDataset(dataset);
        if (!parsedDataset) {
            errorCallback('invalid dataset');
        }
        if (!parsedDataset.descriptionLayer) {
            callback({});
            return;
        }

        var id = dataset.feature.properties[parsedDataset.descriptionId];
        var params = {
            where: getQuery(parsedDataset.photoId, id),
            outFields: parsedDataset.descriptionFields.join(','),
            returnGeometry: false,
            outSR: 4326,
            returnIdsOnly: false,
            returnCountOnly: false,
            returnZ: false,
            returnM: false,
            returnDistinctValues: false,
            f: 'pjson'
        };

        var url = API_URL + parsedDataset.descriptionLayer + '/query';

        return sendRequest(
            url,
            function (response) {
                response = JSON.parse(response);
                return response.features.length
                    ? response.features[0].attributes
                    : {};
            },
            callback,
            errorCallback,
            {'Accept': 'application/json'},
            'POST',
            {data: createQueryParameterString(params)}
        );

    }

    function getItem(dataset, callback, errorCallback) {
        var responses = [];
        var errors = [];

        var extraCalls = [getItemDescription, getItemImage, getItemUserImage];
        var finished = _.after(extraCalls.length, function () {
            if (responses.length) {
                callback(_.reduce(responses, function (acc, res) {
                    console.log(res);
                    _.each(res, function (value, key) {
                        console.log(value, key);
                        if (!acc[key]) {
                            acc[key] = value;
                        } else {
                            console.log("??")
                            if (_.isArray(acc[key]) && _.isArray(value)) {
                                console.log("array")
                                acc[key] = acc[key].concat(value);
                            } else if (_.isObject(acc[key]) && _.isObject(value)) {
                                console.log("object")
                                acc[key] = _.extend({}, acc[key], value);
                            }
                        }
                    });
                    return acc;
                }, {}));
            } else {
                errorCallback(errors);
            }
        });
        _.each(extraCalls, function (func) {
            func(
                dataset,
                function (data) {
                    responses.push(data);
                    finished();
                }, function (err) {
                    errors.push(err);
                    finished();
                }
            );
        });
    }

    function getSublayer(dataset, callback, errorCallback) {
        var parsedDataset = _getDataset(dataset);
        if (!parsedDataset) {
            return;
        }
        if (!_.has(parsedDataset, 'subLayerFunc')) {
            handleError(errorCallback, 'No subLayerFunc ' + dataset.dataset);
            return;
        }
        var key = parsedDataset.subLayerId;
        var func = parsedDataset.subLayerFunc;
        var id = dataset.feature.properties[key];

        func(key, id, callback, errorCallback);
    }

    return {
        getItem: getItem,
        getSublayer: getSublayer,
        getBbox: getBbox
    };
};
