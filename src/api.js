var KR = this.KR || {};

KR.API = function (options) {
    'use strict';

    var norvegianaAPI = new KR.NorvegianaAPI('norvegiana');
    var wikipediaAPI;
    if (KR.WikipediaAPI) {
        wikipediaAPI = new KR.WikipediaAPI(
            'http://crossorigin.me/https://no.wikipedia.org/w/api.php',
            null,
            'http://no.wikipedia.org/?curid=',
            'wikipedia'
        );
    }

    var kulturminnedataAPI;
    if (KR.ArcgisAPI) {
        kulturminnedataAPI = new KR.ArcgisAPI(
            'http://crossorigin.me/http://husmann.ra.no/arcgis/rest/services/Husmann/Husmann/MapServer/',
            'husmann'
        );
    }

    var kulturminnedataSparqlAPI;
    if (KR.SparqlAPI) {
        kulturminnedataSparqlAPI = new KR.SparqlAPI(
            'https://sparql.kulturminne.no/',
            'kulturminne-sparql'
        );
    }

    var cartodbAPI;
    if (KR.CartodbAPI) {
        var cartouser = 'knreise';
        if (_.has(options, 'cartodb')) {
            cartouser = options.cartodb.user;
        }
        cartodbAPI = new KR.CartodbAPI(cartouser, 'cartodb-' + cartouser);
        _.extend(KR.API.mappers, cartodbAPI.mappers());
    }

    var utnoAPI;
    if (KR.UtnoAPI) {
        utnoAPI = new KR.UtnoAPI('utno');
    }

    var folketellingAPI;
    if (KR.FolketellingAPI) {
        folketellingAPI = new KR.FolketellingAPI('folketelling1910');
    }

    var flickrAPI;
    if (KR.FlickrAPI && _.has(options, 'flickr')) {
        flickrAPI = new KR.FlickrAPI(options.flickr.apikey, 'flickr');
    }

    var kmlAPI;
    if (KR.KmlAPI) {
        kmlAPI = new KR.KmlAPI();
    }

    var lokalwikiAPI;
    if (KR.WikipediaAPI) {
        lokalwikiAPI = new KR.WikipediaAPI(
            'http://crossorigin.me/http://test.lokalhistoriewiki.no:8080/api.php',
            null,
            'http://lokalhistoriewiki.no/?curid=',
            'lokalhistoriewiki'
        );
    }

    var jernbanemuseetAPI;
    if (KR.JernbanemuseetAPI && _.has(options, 'jernbanemuseet')) {
        jernbanemuseetAPI = new KR.JernbanemuseetAPI(
            options.jernbanemuseet.apikey,
            'no',
            'jernbanemuseet'
        );
    }

    var apis = {
        norvegiana: norvegianaAPI,
        wikipedia: wikipediaAPI,
        cartodb: cartodbAPI,
        kulturminnedata: kulturminnedataAPI,
        kulturminnedataSparql: kulturminnedataSparqlAPI,
        utno: utnoAPI,
        folketelling: folketellingAPI,
        flickr: flickrAPI,
        kml: kmlAPI,
        lokalhistoriewiki: lokalwikiAPI,
        jernbanemuseet: jernbanemuseetAPI
    };

    var datasets = {
        'Artsdatabanken': {name: 'Artsdatabanken', dataset: {api: 'norvegiana', dataset: 'Artsdatabanken'}},
        'difo': {name: 'Digitalt fortalt', dataset: {api: 'norvegiana', dataset: 'difo'}},
        'DiMu': {name: 'DigitaltMuseum', dataset: {api: 'norvegiana', dataset: 'DiMu'}},
        'Industrimuseum': {name: 'Industrimuseum', dataset: {api: 'norvegiana', dataset: 'Industrimuseum'}},
        'Kulturminnesøk': {name: 'Kulturminnesøk', dataset: {api: 'norvegiana', dataset: 'Kulturminnesøk'}},
        'MUSIT': {name: 'Universitetsmuseene', dataset: {api: 'norvegiana', dataset: 'MUSIT'}},
        'Naturbase': {name: 'Naturbase', dataset: {api: 'norvegiana', dataset: 'Naturbase'}},
        'Stedsnavn': {name: 'Stedsnavn', dataset: {api: 'norvegiana', dataset: 'Stedsnavn'}},
        'wikipedia': {name: 'Wikipedia', dataset: {api: 'wikipedia'}},
        'search_1': {name: 'Byantikvaren i Oslo', dataset: {api: 'cartodb', table: 'search_1'}}
    };

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
        if (!cartodbAPI) {
            throw new Error('CartoDB api not configured!');
        }
        cartodbAPI.getCountyBounds(
            counties,
            callback,
            errorCallback
        );
    }

    return {
        getData: getData,
        getWithin: getWithin,
        getBbox: getBbox,
        getMunicipalityBounds: getMunicipalityBounds,
        getCountyBounds: getCountyBounds,
        datasets: function () {
            return _.extend({}, datasets);
        },
        getNorvegianaItem: function (item, callback) {
            apis.norvegiana.getItem(item, callback);
        },
        getJernbaneItem: function (item, callback) {
            apis.jernbanemuseet.getItem(item, callback);
        }
    };

};

KR.API.mappers = {};
