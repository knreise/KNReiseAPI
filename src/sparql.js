/*global proj4:false, wellknown:false */
var KR = this.KR || {};

KR.SparqlAPI = function (BASE_URL) {
    'use strict';

    if (typeof proj4 !== 'undefined') {
        proj4.defs([
            [
                'EPSG:32633',
                '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs'
            ]
        ]);
    }

    function _transform(coordinates) {
        if (typeof proj4 === 'undefined') {
            throw new Error('Proj4js not found!');
        }
        return proj4('EPSG:32633', 'EPSG:4326', coordinates);
    }

    function _parseGeom(geom) {
        geom = wellknown.parse(geom.value);
        if (geom.type === 'Point') {
            geom.coordinates = _transform(geom.coordinates);
        }
        if (geom.type === 'Polygon') {

            geom.coordinates = _.map(geom.coordinates, function (ring) {
                return _.map(ring, _transform);
            });
        }

        return geom;
    }

    function _parseResponse(response) {

        response = JSON.parse(response);
        var features = _.map(response.results.bindings, function (item) {
            var keys = _.without(_.keys(item), 'punkt', 'omraade');
            var attrs = _.reduce(keys, function (acc, key) {
                acc[key] = item[key].value;
                return acc;
            }, {});
            if (_.has(item, 'punkt')) {
                return KR.Util.createGeoJSONFeatureFromGeom(
                    _parseGeom(item.punkt),
                    attrs
                );
            }
            if (_.has(item, 'omraade')) {
                return KR.Util.createGeoJSONFeatureFromGeom(
                    _parseGeom(item.omraade),
                    attrs
                );
            }
            return null;
        });
        return KR.Util.createFeatureCollection(_.compact(features));
    }

    function _createQuery(dataset) {
        var filter;
        if (dataset.filter) {
            filter = dataset.filter;
        } else if (dataset.fylke) {
            filter = 'regex(?kommune, "^.*' + dataset.fylke + '[1-9]{2}")';
        } else {
            throw new Error('not enough parameters to api!');
        }


        var fields = [
            '?lokid',
            '?label',
            '?beskrivelse',
            '?loklab',
            '?lokimg'
        ];

        var where = [
            '?lok a <https://data.kulturminne.no/askeladden/schema/Lokalitet> .',
            '?lok <http://www.w3.org/2000/01/rdf-schema#label> ?label .',
            '?lok <https://data.kulturminne.no/askeladden/schema/i-kommune> ?kommune .',
            '?lok <https://data.kulturminne.no/askeladden/schema/beskrivelse> ?beskrivelse .',
            '?lok <https://data.kulturminne.no/askeladden/schema/lokalitetskategori> ?lokalitetskategori.'
        ];

        if (dataset.geomType === 'point') {
            fields.push('?punkt');
            where.push('?lok <https://data.kulturminne.no/askeladden/schema/geo/point/etrs89> ?punkt .');
        } else if (dataset.geomType === 'polygon') {
            fields.push('?omraade');
            where.push('?lok <https://data.kulturminne.no/askeladden/schema/geo/area/etrs89> ?omraade .');
        } else {
            throw new Error('Invalid geomType: ' + dataset.geomType);
        }

        var query = 'SELECT ' + fields.join(' ') +
                    ' where {' +
                    where.join('\n') +
                    '?lokalitetskategori rdfs:label ?loklab .' +
                    'FILTER ' + filter +
                    'BIND(REPLACE(STR(?kommune), "http://psi.datanav.info/difi/geo/kommune/", "") AS ?kommuneid)' +
                    'BIND(REPLACE(STR(?lok), "https://data.kulturminne.no/askeladden/lokalitet/", "") AS ?lokid)' +
                    'BIND(bif:concat("http://kulturminnebilder.ra.no/fotoweb/cmdrequest/rest/PreviewAgent.fwx?ar=5001&sz=400&rs=0&pg=0&sr=", ?lokid) AS ?lokimg)' +
                    '}';
        if (dataset.limit) {
            query += 'LIMIT ' + dataset.limit;
        }
        return query;
    }

    function getData(dataset, callback, errorCallback, options) {
        dataset = _.extend({}, {geomType: 'point'}, dataset);
        var params = {
            'default-graph-uri': '',
            'query': _createQuery(dataset),
            'format': 'application/sparql-results+json',
            'timeout': 0,
            'debug': 'off'
        };

        var url = BASE_URL + '?'  + KR.Util.createQueryParameterString(params);
        KR.Util.sendRequest(url, _parseResponse, callback, errorCallback);
    }

    return {
        getData: getData
    };
};
