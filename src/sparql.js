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

    function _parseResponse(response, errorCallback) {
        try {
            response = JSON.parse(response);
        } catch (e) {
            KR.Util.handleError(errorCallback, response);
            return;
        }

        var features = _.map(response.results.bindings, function (item) {
            var keys = _.without(_.keys(item), 'point', 'omraade');
            var attrs = _.reduce(keys, function (acc, key) {
                acc[key] = item[key].value;
                return acc;
            }, {});

            if (!attrs.img) {
                attrs.img = false;
            }
            attrs.thumbnail = attrs.img;
            attrs.title = attrs.name;

            if (_.has(item, 'point')) {
                return KR.Util.createGeoJSONFeatureFromGeom(
                    _parseGeom(item.point),
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

        return KR.Util.createFeatureCollection(features);
    }

    function _createQuery(dataset, errorCallback) {

        if (!dataset.kommune) {
            KR.Util.handleError(errorCallback, 'missing parameter kommune');
            return;
        }

        var query = 'select distinct ?id ?name ?description ?loccatlabel ?img (SAMPLE(?point) as ?point)  {' +
            ' ?id a ?type ;' +
            ' rdfs:label ?name ;' +
            ' <https://data.kulturminne.no/askeladden/schema/beskrivelse> ?description ;' +
            ' <https://data.kulturminne.no/askeladden/schema/lokalitetskategori> ?loccat ;' +
            ' ?p <http://psi.datanav.info/difi/geo/kommune/' + dataset.kommune + '> ;' +
            ' <https://data.kulturminne.no/askeladden/schema/geo/point/etrs89> ?point .' +
            ' ?loccat rdfs:label ?loccatlabel .' +
            ' optional {' +
            '  ?picture <https://data.kulturminne.no/bildearkivet/schema/lokalitet> ?id .' +
            '  ?picture <https://data.kulturminne.no/schema/source-link> ?link' +
            '  BIND(REPLACE(STR(?id), "https://data.kulturminne.no/askeladden/lokalitet/", "") AS ?lokid)' +
            '  BIND(bif:concat("http://kulturminnebilder.ra.no/fotoweb/cmdrequest/rest/PreviewAgent.fwx?ar=5001&sz=600&rs=0&pg=0&sr=", ?lokid) AS ?img)' +
            ' }' +
            '}';
        if (dataset.limit) {
            query += 'LIMIT ' + dataset.limit;
        }
        return query;
    }

    function getData(dataset, callback, errorCallback, options) {
        dataset = _.extend({}, {geomType: 'point'}, dataset);
        var query = _createQuery(dataset);

        if (!query) {
            return;
        }

        var params = {
            'default-graph-uri': '',
            'query': query,
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