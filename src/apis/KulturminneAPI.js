import * as _ from 'underscore';
import ArcgisAPI from './ArcgisAPI';

import sendRequest from '../util/sendRequest';
import handleError from '../util/handleError';
import Mapper from '../mappings';
//import mockData from '../mockdata/fotoweb';



export default function KulturminneAPI(apiName) {

    var mapData = Mapper(apiName);

    var API_URL = 'http://kart.ra.no/arcgis/rest/services/Distribusjon/Kulturminner/MapServer/';
    var IMAGE_API_BASE = 'http://kulturminnebilder.ra.no';

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
            photoId: 'KulturminneID'
        },
        lokaliteter: {
            layer: 5,
            photoId: 'LokalitetID',
            subLayerId: 'LokalitetID',
            subLayerFunc: _getEnkeltminner
        },
        kulturmiljoer: {
            layer: 7,
            photoId: 'KulturmiljoID'
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


        //lenke: href

        //metadata
            //opphavsperson: 116
            //lisens: 315

        /*
        •   navn- tittel på det objektet som vises
        •   selve mediefila – bilde, video eller lydfil
        •   beskrivelse
        •   opphavsperson / rettighetshaver
        •   lisens
        •   lenke til original publisering
        */

        //bilde
        //previews where size == 600

    }

    function getItem(dataset, callback, errorCallback) {
        var parsedDataset = _getDataset(dataset);
        if (!parsedDataset) {
            return;
        }
        var id = dataset.feature.properties[parsedDataset.photoId];

        //var data = _parseItem(mockData, callback);

        //callback(data);


        var url = IMAGE_API_BASE + '/fotoweb/archives/5001-Alle%20kulturminnebilder/?212=' + id;
        return sendRequest(
            url,
            _parseItem,
            callback,
            errorCallback,
            {'Accept': 'application/vnd.fotoware.assetlist+json'}
        );

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
