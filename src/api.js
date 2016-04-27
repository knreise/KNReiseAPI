var KR = this.KR || {};

KR.API = function (options) {
    'use strict';
    options = options || {};

    var apiConfig = {
        norvegiana: {
            api: KR.NorvegianaAPI,
            params: {}
        },
        wikipedia: {
            api: KR.WikipediaAPI,
            params: {url: 'http://www.knreise.no/miniProxy/miniProxy.php/https://no.wikipedia.org/w/api.php', linkBase: 'http://no.wikipedia.org/?curid='}
        },
        wikipediaNN: {
            api: KR.WikipediaAPI,
            params: {url: 'http://www.knreise.no/miniProxy/miniProxy.php/https://nn.wikipedia.org/w/api.php', linkBase: 'http://nn.wikipedia.org/?curid='}
        },
        cartodb: {
            api: KR.CartodbAPI,
            extend: true,
            params: {user: 'knreise'}
        },
        kulturminnedata: {
            api: KR.ArcgisAPI,
            params: {url: 'http://husmann.ra.no/arcgis/rest/services/Husmann/Husmann/MapServer/'}
        },
        kulturminnedataSparql: {
            api: KR.SparqlAPI,
            params: {url: 'http://crossorigin.me/https://sparql.kulturminne.no/'}
        },
        utno: {
            api: KR.UtnoAPI,
            params: {}
        },
        folketelling: {
            api: KR.FolketellingAPI,
            params: {}
        },
        flickr: {
            api: KR.FlickrAPI,
            extend: true,
            params: {}
        },
        kml: {
            api: KR.KmlAPI,
            params: {}
        },
        gpx: {
            api: KR.GpxAPI,
            params: {}
        },
        geojson: {
            api: KR.GeoJsonAPI,
            params: {}
        },
        lokalhistoriewiki: {
            api: KR.WikipediaAPI,
            params: {
                url: 'http://www.knreise.no/miniProxy/miniProxy.php/http://test.lokalhistoriewiki.no:8080/api.php',
                linkBase: 'http://lokalhistoriewiki.no/?curid=',
                maxRadius: 100000
            }
        },
        jernbanemuseet: {
            api: KR.JernbanemuseetAPI,
            extend: true,
            params: {lang: 'no'}
        }
    };

    function _createApis() {
        return _.reduce(apiConfig, function (acc, params, key) {
            var apiOptions = params.params;
            if (params.extend) {
                apiOptions = _.extend(apiOptions, options[key]);
            }
            acc[key] = new params.api(key, apiOptions);
            return acc;
        }, {});
    }


    var apis = _createApis();


    function _distanceFromBbox(api, dataset, bbox, callback, errorCallback, options) {
        bbox = KR.Util.splitBbox(bbox);

        var lng1 = bbox[0],
            lat1 = bbox[1],
            lng2 = bbox[2],
            lat2 = bbox[3];

        var centerLng = (lng1 + lng2) / 2;
        var centerLat = (lat1 + lat2) / 2;

        var radius = _.max([
            KR.Util.haversine(lat1, lng1, centerLat, centerLng),
            KR.Util.haversine(lat2, lng2, centerLat, centerLng)
        ]);

        var latLng = {lat: centerLat, lng: centerLng};
        api.getWithin(dataset, latLng, radius, callback, errorCallback, options);
    }

    function _getAPI(apiName) {
        var api = apis[apiName];
        if (api) {
            return api;
        }
        throw new Error('Unknown API');
    }

    /*
        Get all features from a dataset
    */
    function getData(dataset, callback, errorCallback, options) {
        options = options || {};
        var api = _getAPI(dataset.api);
        api.getData(dataset, callback, errorCallback, options);
    }


    /*
        Get features from a dataset within a bbox
    */
    function getBbox(dataset, bbox, callback, errorCallback, options) {
        options = options || {};
        var api = _getAPI(dataset.api);
        if (_.has(api, 'getBbox')) {
            api.getBbox(dataset, bbox, callback, errorCallback, options);
        } else {
            _distanceFromBbox(
                api,
                dataset,
                bbox,
                callback,
                errorCallback,
                options
            );
        }
    }

    /*
        Get features from a dataset within a radius of a given point
    */
    function getWithin(dataset, latLng, distance, callback, errorCallback, options) {
        options = options || {};
        distance = distance || 5000;
        var api = _getAPI(dataset.api);
        api.getWithin(
            dataset,
            latLng,
            distance,
            callback,
            errorCallback,
            options
        );
    }

    /*
        Get bbox-string for one or more norwegian municipalies
    */
    function getMunicipalityBounds(municipalities, callback, errorCallback) {
        var cartodbAPI = _getAPI('cartodb');
        if (!cartodbAPI) {
            throw new Error('CartoDB api not configured!');
        }
        cartodbAPI.getMunicipalityBounds(
            municipalities,
            callback,
            errorCallback
        );
    }

    /*
        Get bbox-string for one or more norwegian counties
    */
    function getCountyBounds(counties, callback, errorCallback) {
        var cartodbAPI = _getAPI('cartodb');
        if (!cartodbAPI) {
            throw new Error('CartoDB api not configured!');
        }
        cartodbAPI.getCountyBounds(
            counties,
            callback,
            errorCallback
        );
    }

    function getItem(dataset, callback, errorCallback) {
        var api = _getAPI(dataset.api);
        if (_.has(api, 'getItem')) {
            api.getItem(dataset, callback, errorCallback);
        } else if (errorCallback) {
            errorCallback('No getItem function for api ' + dataset.api);
        } else {
            throw new Error('No getItem function for api ' + dataset.api);
        }
    }

    return {
        getData: getData,
        getWithin: getWithin,
        getBbox: getBbox,
        getMunicipalityBounds: getMunicipalityBounds,
        getCountyBounds: getCountyBounds,
        getItem: getItem,
        getCollection: function (collectionName, callback, errorCallback) {
            var norvegianaAPI = _getAPI('norvegiana');
            norvegianaAPI.getCollection(collectionName, callback, errorCallback);
        },
        addApi: function (name, api, params) {
            if (_.has(apiConfig, name)) {
                throw new Error('API with name ' + name + ' already exists');
            }
            params = params || {};
            apiConfig[name] = {
                api: api,
                params: params
            };
            apis = _createApis();
        }
    };

};

KR.API.mappers = {};
