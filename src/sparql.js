/*global proj4:false, wellknown:false */
var KR = this.KR || {};

KR.SparqlAPI = function (apiName, options) {
    'use strict';

    var BASE_URL = options.url;

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
        if (geom.type === 'MultiPolygon') {
            geom.coordinates = _.map(geom.coordinates, function (g) {
                return _.map(g.coordinates, function (ring) {
                    return _.map(ring, _transform);
                });
            });
        }


        return geom;
    }

    function _parseResponse(response, errorCallback) {

        var features = _.map(response.results.bindings, function (item) {
            var keys = _.without(_.keys(item), 'point', 'omraade');
            var attrs = _.reduce(keys, function (acc, key) {
                acc[key] = item[key].value;
                return acc;
            }, {});

            if (!attrs.img) {
                attrs.img = false;
            }
            attrs.title = attrs.name;

            if (_.has(item, 'point')) {
                return KR.Util.createGeoJSONFeatureFromGeom(
                    _parseGeom(item.point),
                    attrs,
                    apiName + '_' + attrs.id
                );
            }
            if (_.has(item, 'omraade')) {
                return KR.Util.createGeoJSONFeatureFromGeom(
                    _parseGeom(item.omraade),
                    attrs,
                    apiName + '_' + attrs.id
                );
            }
            return null;
        });

        return KR.Util.createFeatureCollection(features);
    }

    function _parselokalitetPoly(response, errorCallback) {
        var bindings = response.results.bindings;
        if (!bindings || bindings.length === 0) {
            KR.Util.handleError(errorCallback);
            return;
        }

        var features = _.map(bindings, function (binding) {
            binding.lok.type = 'Polygon';
            return KR.Util.createGeoJSONFeatureFromGeom(_parseGeom(binding.lok), {});
        });


        var polygons = _.map(features, function (feature) {
            return feature.geometry;
        });

        var collection = {
            'type': 'GeometryCollection',
            'geometries': polygons
        };

        return KR.Util.createGeoJSONFeatureFromGeom(collection, {});
    }


    function _parseEnkeltminnePoly(response, errorCallback) {
        var bindings = response.results.bindings;
        return bindings;
    }


    function _sendQuery(query, parse, callback, errorCallback) {
        var params = {
            'default-graph-uri': '',
            'query': query,
            'format': 'application/sparql-results+json',
            'timeout': 0,
            'debug': 'off'
        };

        var url = BASE_URL + '?'  + KR.Util.createQueryParameterString(params);
        KR.Util.sendRequest(url, parse, callback, errorCallback);
    }

    function _createKommuneQuery(dataset) {

        if (!dataset.kommune) {
            return;
        }

        var query = 'select distinct ?id ?name ?description ?loccatlabel ?locartlabel ?orglabel ?img ?thumbnail (SAMPLE(?point) as ?point) ?url as ?link ?picture ?picturelabel ?picturedescription ?picturelicence { ' +
        ' ?id a ?type ; ' +
        ' rdfs:label ?name ; ' +
        ' <https://data.kulturminne.no/askeladden/schema/beskrivelse> ?description ; ' +
        ' <https://data.kulturminne.no/askeladden/schema/lokalitetskategori> ?loccat ; ' +
        ' <https://data.kulturminne.no/askeladden/schema/lokalitetsart> ?locart ; ' +
        ' <https://data.kulturminne.no/askeladden/schema/AnsvarligOrganisasjon> ?org ; ' +
        ' ?p <https://data.kulturminne.no/difi/geo/kommune/' + dataset.kommune + '> ; ' +
        ' <https://data.kulturminne.no/askeladden/schema/geo/point/etrs89> ?point . ' +
        ' optional { ?loccat rdfs:label ?loccatlabel .} ' +
        ' optional { ?locart rdfs:label ?locartlabel .} ' +
        ' optional { ?org rdfs:label ?orglabel .} ' +
        ' BIND(REPLACE(STR(?id), "https://data.kulturminne.no/askeladden/lokalitet/", "") AS ?lokid) ' +
        ' BIND(bif:concat("http://www.kulturminnesok.no/kulturminnesok/kulturminne/?LOK_ID=", ?lokid) AS ?url) ' +
        ' optional { ' +
        '  ?picture <https://data.kulturminne.no/bildearkivet/schema/lokalitet> ?id . ' +
        '  ?picture <https://data.kulturminne.no/schema/source-link> ?link . ' +
        '  ?picture rdfs:label ?picturelabel . ' +
        '  ?picture dc:description ?picturedescription . ' +
        '  ?picture <https://data.kulturminne.no/bildearkivet/schema/license> ?picturelicence . ' +
        '  BIND(REPLACE(STR(?id), "https://data.kulturminne.no/askeladden/lokalitet/", "") AS ?lokid) ' +
        '  BIND(bif:concat("http://kulturminnebilder.ra.no/fotoweb/cmdrequest/rest/PreviewAgent.fwx?ar=5001&sz=600&rs=0&pg=0&sr=", ?lokid) AS ?img) ' +
        '  BIND(bif:concat("http://kulturminnebilder.ra.no/fotoweb/cmdrequest/rest/PreviewAgent.fwx?ar=5001&sz=75&rs=0&pg=0&sr=", ?lokid) AS ?thumbnail)' +
        '} ';

        if (dataset.filter) {
            query += ' ' + dataset.filter;
        }
        query += '}';
        if (dataset.limit) {
            query += 'LIMIT ' + dataset.limit;
        }
        return query;
    }

    function _createFylkeQuery(dataset) {

        if (!dataset.fylke) {
            return;
        }

        var fylke = parseInt(dataset.fylke, 10);
        if (fylke < 10) {
            fylke = '0' + fylke;
        }

        var query = ' select distinct ?id ?name ?description ?loccatlabel ?locartlabel ?orglabel ?img ?thumbnail (SAMPLE(?point) as ?point) ?url as ?link ?picture ?picturelabel ?picturedescription ?picturelicence { ' +
            ' ?id a ?type ; ' +
            ' rdfs:label ?name ; ' +
            ' <https://data.kulturminne.no/askeladden/schema/beskrivelse> ?description ; ' +
            ' <https://data.kulturminne.no/askeladden/schema/lokalitetskategori> ?loccat ; ' +
            ' <https://data.kulturminne.no/askeladden/schema/lokalitetsart> ?locart ; ' +
            ' <https://data.kulturminne.no/askeladden/schema/AnsvarligOrganisasjon> ?org ; ' +
            ' <https://data.kulturminne.no/askeladden/schema/i-kommune> ?kommune ; ' +
            ' <https://data.kulturminne.no/askeladden/schema/geo/point/etrs89> ?point . ' +
            ' optional { ?loccat rdfs:label ?loccatlabel .} ' +
            ' optional { ?locart rdfs:label ?locartlabel .} ' +
            ' optional { ?org rdfs:label ?orglabel .} ' +
            ' BIND(REPLACE(STR(?id), "https://data.kulturminne.no/askeladden/lokalitet/", "") AS ?lokid) ' +
            ' BIND(bif:concat("http://www.kulturminnesok.no/kulturminnesok/kulturminne/?LOK_ID=", ?lokid) AS ?url) ' +
            ' optional { ' +
            '  ?picture <https://data.kulturminne.no/bildearkivet/schema/lokalitet> ?id . ' +
            '  ?picture <https://data.kulturminne.no/schema/source-link> ?link . ' +
            '  ?picture rdfs:label ?picturelabel . ' +
            '  ?picture dc:description ?picturedescription . ' +
            '  ?picture <https://data.kulturminne.no/bildearkivet/schema/license> ?picturelicence . ' +
            '  BIND(REPLACE(STR(?id), "https://data.kulturminne.no/askeladden/lokalitet/", "") AS ?lokid) ' +
            '  BIND(bif:concat("http://kulturminnebilder.ra.no/fotoweb/cmdrequest/rest/PreviewAgent.fwx?ar=5001&sz=600&rs=0&pg=0&sr=", ?lokid) AS ?img) ' +
            '  BIND(bif:concat("http://kulturminnebilder.ra.no/fotoweb/cmdrequest/rest/PreviewAgent.fwx?ar=5001&sz=75&rs=0&pg=0&sr=", ?lokid) AS ?thumbnail) ' +
            ' } ' +
            ' FILTER regex(?kommune, "^.*' + fylke + '[1-9]{2}") . ';

        if (dataset.filter) {
            query += ' ' + dataset.filter;
        }
        query += ' } order by ?img';

        if (dataset.limit) {
            query += 'LIMIT ' + dataset.limit;
        }
        return query;
    }

    function _polyForLokalitetQuery(lokalitet) {
        return 'SELECT ?lok where ' +
            '{ ' +
            '  <' + lokalitet.trim() + '> <https://data.kulturminne.no/askeladden/schema/geo/area/etrs89> ?lok . ' +
            '}';
    }

    function _enkeltminneForLokalitetQuery(lokalitet) {
        return 'SELECT ?enk as ?id ?name ?desc as ?content ?area as ?omraade ?enkcatlabel ' +
            'where { ' +
            '?enk a <https://data.kulturminne.no/askeladden/schema/Enkeltminne> . ' +
            '?enk rdfs:label ?name . ' +
            '?enk <https://data.kulturminne.no/askeladden/schema/i-lokalitet> <' + lokalitet.trim() +  '> . ' +
            '?enk <https://data.kulturminne.no/askeladden/schema/beskrivelse> ?desc . ' +
            '?enk <https://data.kulturminne.no/askeladden/schema/geo/area/etrs89> ?area . ' +
            '?enk <https://data.kulturminne.no/askeladden/schema/enkeltminnekategori> ?enkcat . ' +
            '?enkcat rdfs:label ?enkcatlabel . ' +
            '} ';
    }

    function _polyForLokalitet(dataset, callback, errorCallback) {

        var lokalitet = [];
        if (_.isArray(dataset.lokalitet)) {
            lokalitet = dataset.lokalitet;
        } else {
            lokalitet.push(dataset.lokalitet);
        }


        var features = [];
        var finished = _.after(lokalitet.length, function () {
            callback(KR.Util.createFeatureCollection(features));
        });

        _.each(lokalitet, function (lok) {
            _sendQuery(_polyForLokalitetQuery(lok), _parselokalitetPoly, function (geoJson) {
                geoJson.properties.lok = lok;
                features.push(geoJson);
                finished();
            }, errorCallback);
        });
    }

    function _enkeltminnerForLokalitet(dataset, callback, errorCallback) {

        var lokalitet = [];
        if (_.isArray(dataset.lokalitet)) {
            lokalitet = dataset.lokalitet;
        } else {
            lokalitet.push(dataset.lokalitet);
        }


        var features = [];
        var finished = _.after(lokalitet.length, function () {
            callback(KR.Util.createFeatureCollection(features));
        });

        _.each(lokalitet, function (lok) {
            _sendQuery(_enkeltminneForLokalitetQuery(lok), _parseResponse, function (geoJson) {
                var featuresForLok = _.map(geoJson.features, function (f) {
                    f.properties.lokalitet = lok;
                    return f;
                })
                features = features.concat(featuresForLok);
                finished();
            }, errorCallback);
        });
    }

    function getData(dataset, callback, errorCallback, options) {
        dataset = _.extend({}, {geomType: 'point'}, dataset);
        if (dataset.kommune) {
            var query = _createKommuneQuery(dataset, errorCallback);
            _sendQuery(query, _parseResponse, callback, errorCallback);
        } else if (dataset.fylke) {
            var query = _createFylkeQuery(dataset, errorCallback);
            _sendQuery(query, _parseResponse, callback, errorCallback);
        } else if (dataset.lokalitet && dataset.type === 'lokalitetpoly') {
            _polyForLokalitet(dataset, callback, errorCallback);
        } else if (dataset.lokalitet && dataset.type === 'enkeltminner') {
            _enkeltminnerForLokalitet(dataset, callback, errorCallback);
        } else if (dataset.sparqlQuery) {
            _sendQuery(dataset.sparqlQuery, _parseResponse, callback, errorCallback);
        } else {
            KR.Util.handleError(errorCallback, 'not enough parameters');
        }
    }

    return {
        getData: getData
    };
};
