import * as _ from 'underscore';
import $ from 'jquery';
import csv from 'csvtojson';

import kulturminneMappings from './kulturminne';
import {createFeatureCollection} from '../util';

var mappings = {
    kulturminne: kulturminneMappings
};

function mapper(mappingData) {
    return function (value) {
        var mapping = _.findWhere(mappingData, {'Initialverdi': value});
        return !!mapping ? mapping.Kode : null;
    };
}

export default function Mapper(dataset) {
    if (!_.has(mappings, dataset)) {
        console.error('No mapping file for ' + dataset);
        return null;
    }
    var mapping = mappings[dataset];


    function _doMap(mappingForFeatures, featureCollection, callback) {

        var features = _.map(featureCollection.features, function (feature) {

            _.each(mappingForFeatures, function (data, key) {
                if (feature.properties[key] && data.mapper) {
                    feature.properties[data.newKey] = data.mapper(feature.properties[key]);
                }
            });

            return feature;
        });
        callback(null, createFeatureCollection(features));
    }

    return function map(featureCollection, dataset, callback) {

        if (featureCollection.features.length === 0) {
            callback(null, featureCollection);
            return;
        }

        var mappingForFeatures = _.has(dataset, 'dataset')
            ? mapping[dataset.dataset]
            : mapping;

        var finished = _.after(_.keys(mappingForFeatures).length, function () {
            _doMap(mappingForFeatures, featureCollection, callback);
        });

        _.each(mappingForFeatures, function (mappingData, prop) {
            if (mappingData.mapper) {
                finished();
            } else {
                $.ajax({
                    method: 'get',
                    url: mappingData.url,
                    error: function (err) {
                        finished();
                    },
                    success: function (data) {
                        csv({noheader: false, delimiter: 'auto'})
                            .fromString(data)
                            .on('end_parsed', function (json) {
                                mappingData.mapper = mapper(json);
                                finished();
                            });
                    }
                });
            }
        });
    };
}