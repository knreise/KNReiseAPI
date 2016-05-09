/*global proj4:false, wellknown:false, _:false, window:false */
var KR = this.KR || {};

KR.SparqlAPI = function (apiName, options) {
    'use strict';

    var license = options.licenseText || 'http://data.norge.no/nlod/no';

    var BASE_URL = options.url;

    if (!_.isUndefined(window.proj4)) {
        proj4.defs([
            [
                'EPSG:32633',
                '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs'
            ]
        ]);
    }

    function _transform(coordinates) {
        if (_.isUndefined(window.proj4)) {
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

            if (!attrs.license) {
                attrs.license = license;
            }

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


    function _sendQuery(query, parse, callback, errorCallback) {
        var params = {
            'default-graph-uri': '',
            query: query,
            format: 'application/sparql-results+json',
            timeout: 0,
            debug: 'off'
        };

        var url = BASE_URL;

        var fd = new FormData();
        _.each(params, function (value, key) {
            fd.append(key, value);
        });

        var ajaxOpts = {
            data: fd,
            processData: false,
            contentType: false,
            cache: false,
            method: 'POST'
        };
        KR.Util.sendRequest(url, parse, callback, errorCallback, {}, 'POST', ajaxOpts);
    }

    function _createKommuneQuery(dataset) {

        if (!dataset.kommune) {
            return;
        }

        var query = 'select distinct ?id ?name ?description ?loccatlabel ?locartlabel ?orglabel ?img ?thumbnail (SAMPLE(?point) as ?point) ?url as ?link ?picture ?picturelabel ?picturedescription ?picturelicence { ' +
                ' ?id a ?type ; ' +
                ' rdfs:label ?name ; ' +
                
                ' <https://data.kulturminne.no/askeladden/schema/lokalitetskategori> ?loccat ; ' +
                ' <https://data.kulturminne.no/askeladden/schema/lokalitetsart> ?locart ; ' +
                ' <https://data.kulturminne.no/askeladden/schema/ansvarligorganisasjon> ?org ; ' +
                ' ?p <https://data.kulturminne.no/askeladden/kommune/' + dataset.kommune + '> ; ' +
                ' <https://data.kulturminne.no/askeladden/schema/geo/point/etrs89> ?point . ' +
                ' optional { ?loccat rdfs:label ?loccatlabel .} ' +
                ' optional { ?locart rdfs:label ?locartlabel .} ' +
                ' optional { ?org rdfs:label ?orglabel .} ' +
                ' optional { ?id <https://data.kulturminne.no/askeladden/schema/beskrivelse> ?description .} ' +
                ' BIND(REPLACE(STR(?id), "https://data.kulturminne.no/askeladden/lokalitet/", "") AS ?lokid) ' +
                ' BIND(bif:concat("http://www.kulturminnesok.no/kulturminnesok/kulturminne/?LOK_ID=", ?lokid) AS ?url) ' +
                ' optional { ' +
                ' {select sample(?picture) as ?picture ?id where {?picture <https://data.kulturminne.no/bildearkivet/schema/lokalitet> ?id}} ' +
                '  ?picture <https://data.kulturminne.no/bildearkivet/schema/lokalitet> ?id . ' +
                '  ?picture <https://data.kulturminne.no/schema/source-link> ?link . ' +
                '  ?picture rdfs:label ?picturelabel . ' +
                '  ?picture dc:description ?picturedescription . ' +
                '  ?picture <https://data.kulturminne.no/bildearkivet/schema/license> ?picturelicence . ' +
                '  BIND(REPLACE(STR(?link), "http://kulturminnebilder.ra.no/fotoweb/default.fwx\\\\?search\\\\=", "") AS ?linkid) ' +
                '  BIND(bif:concat("http://kulturminnebilder.ra.no/fotoweb/cmdrequest/rest/PreviewAgent.fwx?ar=5001&sz=600&rs=0&pg=0&sr=", ?linkid) AS ?img) ' +
                '  BIND(bif:concat("http://kulturminnebilder.ra.no/fotoweb/cmdrequest/rest/PreviewAgent.fwx?ar=5001&sz=75&rs=0&pg=0&sr=", ?linkid) AS ?thumbnail) ' +
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
                ' <https://data.kulturminne.no/askeladden/schema/lokalitetskategori> ?loccat ; ' +
                ' <https://data.kulturminne.no/askeladden/schema/lokalitetsart> ?locart ; ' +
                ' <https://data.kulturminne.no/askeladden/schema/ansvarligorganisasjon> ?org ; ' +
                ' <https://data.kulturminne.no/askeladden/schema/kommune> ?kommune ; ' +
                ' <https://data.kulturminne.no/askeladden/schema/geo/point/etrs89> ?point . ' +
                ' optional { ?loccat rdfs:label ?loccatlabel .} ' +
                ' optional { ?locart rdfs:label ?locartlabel .} ' +
                ' optional { ?org rdfs:label ?orglabel .} ' +
                ' optional { ?id <https://data.kulturminne.no/askeladden/schema/beskrivelse> ?description .} ' +
                ' BIND(REPLACE(STR(?id), "https://data.kulturminne.no/askeladden/lokalitet/", "") AS ?lokid) ' +
                ' BIND(bif:concat("http://www.kulturminnesok.no/kulturminnesok/kulturminne/?LOK_ID=", ?lokid) AS ?url) ' +
                ' optional { ' +
                ' {select sample(?picture) as ?picture ?id where {?picture <https://data.kulturminne.no/bildearkivet/schema/lokalitet> ?id}} ' +
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

    function _enkeltminneForLokalitetQuery(lokalitet) {
        return 'SELECT ?enk as ?id ?name ?desc as ?content ?area as ?omraade ?enkcatlabel ' +
                'where { ' +
                '?enk a <https://data.kulturminne.no/askeladden/schema/Enkeltminne> . ' +
                '?enk rdfs:label ?name . ' +
                '?enk <https://data.kulturminne.no/askeladden/schema/i-lokalitet> <' + lokalitet.trim() + '> . ' +
                '?enk <https://data.kulturminne.no/askeladden/schema/beskrivelse> ?desc . ' +
                '?enk <https://data.kulturminne.no/askeladden/schema/geo/area/etrs89> ?area . ' +
                '?enk <https://data.kulturminne.no/askeladden/schema/enkeltminnekategori> ?enkcat . ' +
                '?enkcat rdfs:label ?enkcatlabel . ' +
                '} ';
    }

    function stringStartsWith(string, prefix) {
        return string.slice(0, prefix.length) === prefix;
    }

    function stringEndsWith(string, suffix) {
        return suffix === '' || string.slice(-suffix.length) === suffix;
    }

    function _addBrackets(url) {
        if (!stringStartsWith(url, '<')) {
            url = '<' + url;
        }
        if (!stringEndsWith(url, '>')) {
            url = url + '>';
        }
        return url;
    }


    function _createMultiPolygon(items, lok) {
        var features = _.map(items, function (binding) {
            binding.poly.type = 'Polygon';
            return KR.Util.createGeoJSONFeatureFromGeom(_parseGeom(binding.poly), {});
        });

        var polygons = _.map(features, function (feature) {
            return feature.geometry;
        });

        var collection = {
            type: 'GeometryCollection',
            geometries: polygons
        };

        return KR.Util.createGeoJSONFeatureFromGeom(collection, {lok: lok});
    }

    function _parsePolyForSeveralLokalitet(response) {
        var grouped = _.reduce(response.results.bindings, function (acc, item) {
            var id = item.lok.value;
            if (!_.has(acc, id)) {
                acc[id] = [];
            }
            acc[id].push(item);
            return acc;
        }, {});
        return _.map(grouped, _createMultiPolygon);
    }

    function _polyForLokalitet(dataset, callback, errorCallback) {

        var lokalitet = [];
        if (_.isArray(dataset.lokalitet)) {
            lokalitet = dataset.lokalitet;
        } else {
            lokalitet.push(dataset.lokalitet);
        }

        var query = 'select ?lok ?poly where { ' +
                ' ?lok <https://data.kulturminne.no/askeladden/schema/geo/area/etrs89> ?poly ' +
                ' filter (?lok in (' + _.map(lokalitet, _addBrackets).join(', ') + '))}';

        _sendQuery(query, _parsePolyForSeveralLokalitet, function (features) {
            callback(KR.Util.createFeatureCollection(features));
        }, errorCallback);
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
                });
                features = features.concat(featuresForLok);
                finished();
            }, errorCallback);
        });
    }


    function _parseImagesResponse(response) {
        return _.map(response.results.bindings, function (binding) {
            return _.reduce(binding, function (acc, value, key) {
                acc[key] = value.value;
                return acc;
            });
            return binding;
        });
    }

    function _imagesForLokalitet(dataset, callback, errorCallback) {

        var lokalitet = lokalitet = dataset.lokalitet;

        var query = 'select distinct ?id ?img ?img_fullsize ?url ?link ?linkid ?picturelabel ?picturedescription ?picturelicence {' +
        '?id a ?type . ' +
        'BIND(REPLACE(STR(?id), "https://data.kulturminne.no/askeladden/lokalitet/", "") AS ?lokid) ' +
        'BIND(bif:concat("http://www.kulturminnesok.no/kulturminnesok/kulturminne/?LOK_ID=", ?lokid) AS ?url) ' +
        '?picture <https://data.kulturminne.no/bildearkivet/schema/lokalitet> ?id . ' +
        '?picture <https://data.kulturminne.no/schema/source-link> ?link . ' +
        '?picture rdfs:label ?picturelabel . ' +
        'optional {?picture dc:description ?picturedescription .}' +
        '?picture <https://data.kulturminne.no/bildearkivet/schema/license> ?picturelicence . ' +
        'BIND(REPLACE(STR(?link), "http://kulturminnebilder.ra.no/fotoweb/default.fwx\\\\?search\\\\=", "") AS ?linkid) . ' +
        'BIND(bif:concat("http://kulturminnebilder.ra.no/fotoweb/cmdrequest/rest/PreviewAgent.fwx?ar=5001&sz=600&rs=0&pg=0&sr=", ?linkid) AS ?img) . ' +
        'BIND(bif:concat("http://kulturminnebilder.ra.no/fotoweb/cmdrequest/rest/PreviewAgent.fwx?ar=5001&sz=1000&rs=0&pg=0&sr=", ?linkid) AS ?img_fullsize) . ' +
        'filter(?id=' + _addBrackets(lokalitet) + ') ' +
        '} ';
        _sendQuery(query, _parseImagesResponse, callback, errorCallback);
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
        } else if (dataset.lokalitet && dataset.type === 'images') {
            _imagesForLokalitet(dataset, callback, errorCallback);
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
