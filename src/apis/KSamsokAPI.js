import * as _ from 'underscore';
import X2JS from 'x2js';

import sendRequest from '../util/sendRequest';
import {
    createGeoJSONFeature,
    createFeatureCollection,
    createQueryParameterString,
    splitBbox
} from '../util';


export default function KSamsokAPI(apiName, options) {

    options = options || {};
    //var requests = [];

    var BASE_URL = options.baseUrl;
    var apikey = options.apikey;

    var bboxTemplate = _.template('boundingBox=/WGS84 "<%= w %> <%= s %> <%= e %> <%= n %>"');

    function _bboxQuery(bbox) {
        bbox = splitBbox(bbox);
        return bboxTemplate({
            s: bbox[1],
            n: bbox[3],
            w: bbox[0],
            e: bbox[2]
        });
    }

    function _parseRecord(record) {

        var properties = _.reduce(record.field, function (acc, field) {
            acc[field._name] = field.__text;
            return acc;
        }, {});

        var lon = parseFloat(properties.lon);
        var lat = parseFloat(properties.lat);

        var props = _.reduce(properties, function (acc, value, key) {
            if (key !== 'lat' && key !== 'lon') {
                acc[key] = value;
            }
            return acc;
        }, {});

        props.title = props.itemLabel;

        return createGeoJSONFeature(
            {
                lat: lat,
                lng: lon
            },
            props,
            apiName + '_' + properties.itemId
        );

        /*
        var item = record.item;
        console.log('!', item);
        if (!_.has(item, 'where')) {
            return null;
        }
        var pos = item.where.Point.coordinates.toString().split(',');

        var properties = _.chain(_.keys(item))
            .filter(function (key) {
                return !key.startsWith('__');
            })
            .reduce(function (acc, key) {
                var data = item[key];
                if (_.has(data, '__text')) {
                    acc[key] = data['__text'];
                }
                return acc;
            }, {})
            .value();
        console.log(properties.id);

        properties.title = properties.itemLabel;

        return KR.Util.createGeoJSONFeature(
            {
                lat: parseFloat(pos[1]),
                lng: parseFloat(pos[0])
            },
            properties,
            null
        );
        */
    }
    /*
    function _parseDescription(description) {

        return null;
    }*/

    function _parseItems(response) {

        var x2js = new X2JS();
        var json = x2js.xml2json(response);

        var features = _.chain(json.result.records.record)
            .map(_parseRecord)
            .filter(function (feature) {
                return !!feature;
            })
            .value();
        return createFeatureCollection(features);
    }


    function _parseItem(response) {
        var x2js = new X2JS();
        var json = x2js.xml2json(response);
        var item = json.RDF.Description[0].presentation.item;
        var image;
        if (_.has(item, 'image')) {
            var img = _.find(item.image.src, function (src) {
                return src._type === 'lowres';
            });
            if (img) {
                image = img.__text;
            }
        }
        return {
            itemDescription: item.description.__text,
            image: image
        };
    }

    function getBbox(parameters, bbox, callback, errorCallback, options) {
        var params = {
            method: 'search',
            hitsPerPage: 500,
            'x-api': apikey,
            query: _bboxQuery(bbox),
            recordSchema: 'xml',
            fields: 'itemLabel,itemDescription,lon,lat,thumbnail,url,itemLicense'
        };

        var url = BASE_URL + '?' + createQueryParameterString(params);
        sendRequest(url, _parseItems, callback, errorCallback);
    }

    /*
    function getWithin(parameters, latLng, distance, callback, errorCallback, options) {
    }
    */
    /*
    function getData(parameters, callback, errorCallback, options) {
    }
    */

    function getItem(dataset, callback, errorCallback) {
        var url = options.proxyUrl + dataset.itemId;
        sendRequest(url, _parseItem, callback, errorCallback);
    }

    return {
        //getWithin: getWithin,
        getItem: getItem,
        getBbox: getBbox
        //getData: getData
    };
};
