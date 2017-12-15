import * as _ from 'underscore';

import sendRequest from '../util/sendRequest';
import {
    createFeatureCollection,
    createQueryParameterString,
} from '../util';

export default function CartodbAPI(apiName, options) {

    var USER = options.user;

    function _getURL(user) {
        return 'http://' + user + '.cartodb.com/api/v2/sql';
    }

    function _createMapper(propertyMap) {

        return function (response) {
            var features = _.map(response.rows, function (row) {
                var geom = JSON.parse(row.geom);
                var properties = _.reduce(row, function (acc, value, key) {
                        if (_.has(propertyMap, key)) {
                            var k = propertyMap[key];
                            if (_.isArray(k)) {
                                _.each(k, function (k) {
                                    acc[k] = value;
                                });
                            } else {
                                acc[k] = value;
                            }
                        }
                        return acc;
                    }, {});
                return {
                    'type': 'Feature',
                    'geometry': geom,
                    'properties': properties
                };
            });
            return createFeatureCollection(features);
        };
    }

    var columnList = {
        'default': {
            delving_thumbnail: ['images', 'thumbnail'],
            dc_title: 'title',
            dc_description: 'content',
            europeana_isshownat: 'link',
            europeana_collectiontitle: 'dataset',
            abm_contentProvider: 'provider',
            europeana_type: 'contentType',
            delving_landingpage: 'video'
        },
        pilegrimsleden_dovre: {
            iid: 'id',
            name: 'name',
            omradenavn: 'omradenavn'
        }
    };

    var _parseItems = _createMapper(columnList['default']);

    function mappers() {

        return _.reduce(columnList, function (acc, columns, dataset) {
            acc[dataset] = _createMapper(columns);
            return acc;
        }, {
            cartodb_general: function (response) {
                var features = _.map(response.rows, function (row) {
                    var geom = JSON.parse(row.geom);
                    return {
                        'type': 'Feature',
                        'geometry': geom,
                        'properties': _.omit(row, 'geom')
                    };
                });
                return createFeatureCollection(features);
            }
        });
    }

    function _executeSQL(sql, mapper, callback, errorCallback, user) {
        var params = {
            q: sql
        };
        var cdbuser = user || USER;
        var url = _getURL(cdbuser) + '?' + createQueryParameterString(params);
        sendRequest(url, mapper, callback, errorCallback);
    }

    function _parseExtent(response) {
        var extent = response.rows[0].st_extent;
        return extent.replace('BOX(', '').replace(')', '').replace(/ /g, ',');
    }


    function _createSelect(select, from, where) {
        var sql = [
            'SELECT ' + select,
            'FROM ' + from
        ];
        if (where) {
            sql.push('WHERE ' + where);
        }
        return sql.join(' ');
    }

    function _dwithin(latLng, distance) {
        return 'ST_DWithin(' +
               'the_geom::geography,' +
               '\'POINT(' + latLng.lng + ' ' + latLng.lat + ')\'::geography, ' +
               distance + ');';
    }

    function _getMapper(dataset) {
        var mapper = dataset.mapper;
        if (!mapper) {
            mapper = mappers().cartodb_general;
        }
        return mapper;
    }

    function _toArray(value) {
        if (!_.isArray(value)) {
            return [value];
        }
        return value;
    }

    function getMunicipalityBounds(municipalities, callback, errorCallback) {
        var sql = _createSelect(
            'ST_Extent(the_geom)',
            'kommuner',
            'komm in (' + _toArray(municipalities).join(', ') + ')'
        );

        _executeSQL(sql, _parseExtent, callback, errorCallback, 'knreise');
    }

    function getCountyBounds(counties, callback, errorCallback) {
        var sql = _createSelect(
            'ST_Extent(the_geom)',
            'fylker',
            'fylkesnr in (' + _toArray(counties).join(', ') + ')'
        );

        _executeSQL(sql, _parseExtent, callback, errorCallback, 'knreise');
    }

    function getData(dataset, callback, errorCallback) {
        var mapper = _getMapper(dataset);
        var sql;
        if (dataset.query) {
            sql = dataset.query;
        } else if (dataset.table) {
            var columns = dataset.columns;
            if (!columns) {
                columns = ['*'];
            }
            if (_.has(columnList, dataset.table)) {
                columns = _.keys(columnList[dataset.table]);
            }
            columns.push('ST_AsGeoJSON(the_geom) as geom');
            sql = 'SELECT ' + columns.join(', ') + ' FROM ' + dataset.table;
        } else if (dataset.county) {
            sql = _createSelect(
                'ST_AsGeoJSON(the_geom) as geom',
                'fylker',
                'fylkesnr in (' + _toArray(dataset.county).join(', ') + ')'
            );
        } else if (dataset.municipality) {

            sql = _createSelect(
                'ST_AsGeoJSON(the_geom) as geom',
                'kommuner',
                'komm in (' + _toArray(dataset.municipality).join(', ') + ')'
            );
        }
        if (sql) {
            _executeSQL(sql, mapper, callback, errorCallback);
        }
    }

    function getBbox(dataset, bbox, callback, errorCallback) {
        var columns = dataset.columns;
        if (!columns) {
            columns = ['*'];
        }
        columns.push('ST_AsGeoJSON(the_geom) as geom');

        var sql = _createSelect(
            columns.join(', '),
            dataset.table,
            'ST_Intersects(the_geom, ST_MakeEnvelope(' + bbox + ', 4326))'
        );

        var mapper = _getMapper(dataset);
        _executeSQL(sql, mapper, callback, errorCallback);
    }

    function getWithin(dataset, latLng, distance, callback, errorCallback) {
        var select = _.keys(columnList['default']).concat(
            ['ST_AsGeoJSON(the_geom) as geom']
        ).join(', ');

        var sql = _createSelect(
            select,
            dataset.table,
            _dwithin(latLng, distance)
        );
        _executeSQL(sql, _parseItems, callback, errorCallback);
    }

    return {
        getBbox: getBbox,
        getData: getData,
        getWithin: getWithin,
        getMunicipalityBounds: getMunicipalityBounds,
        getCountyBounds: getCountyBounds,
        mappers: mappers
    };
};
