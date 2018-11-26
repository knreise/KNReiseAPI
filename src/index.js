import * as _ from 'underscore';

import {
    splitBbox,
    haversine
} from './util';


import NorvegianaAPI from './apis/NorvegianaAPI';
import WikipediaAPI from './apis/WikipediaAPI';
import LokalhistoriewikiAPI from './apis/LokalhistoriewikiAPI';
import CartodbAPI from './apis/CartodbAPI';
import ArcgisAPI from './apis/ArcgisAPI';
import KulturminneAPI from './apis/KulturminneAPI';
import UtnoAPI from './apis/UtnoAPI';
import FolketellingAPI from './apis/FolketellingAPI';
import FlickrAPI from './apis/FlickrAPI';
import KmlAPI from './apis/KmlAPI';
import GpxAPI from './apis/GpxAPI';
import GeoJsonAPI from './apis/GeoJsonAPI';
import JernbanemuseetAPI from './apis/JernbanemuseetAPI';
import EuropeanaAPI from './apis/EuropeanaAPI';
import KSamsokAPI from './apis/KSamsokAPI';
import BrukerminnerAPI from './apis/BrukerminnerAPI';


export default function KnreiseAPI(options) {
    options = options || {};

    var proxyUrl = options.proxyUrl || 'http://kd-miniproxy.ra.no/miniProxy.php/';

    var apiConfig = {
        norvegiana: {
            api: NorvegianaAPI,
            params: {
                baseUrl: 'http://kulturnett2.delving.org/api/search',
                baseCollectionUrl: 'http://acc.norvegiana.delving.org/en/api/knreise-collection/'
            }
        },
        wikipedia: {
            api: WikipediaAPI,
            params: {
                url: proxyUrl + 'https://no.wikipedia.org/w/api.php',
                imageBase: 'http://upload.wikimedia.org/wikipedia/commons/',
                linkBase: 'http://no.wikipedia.org/?curid='
            }
        },
        wikipediaNN: {
            api: WikipediaAPI,
            params: {
                url: proxyUrl + 'https://nn.wikipedia.org/w/api.php',
                imageBase: 'http://upload.wikimedia.org/wikipedia/commons/',
                linkBase: 'http://nn.wikipedia.org/?curid='
            }
        },
        cartodb: {
            api: CartodbAPI,
            extend: true,
            params: {user: 'knreise'}
        },
        kulturminnedata: {
            api: ArcgisAPI,
            params: {
                url: 'http://askeladden.ra.no/arcgis/rest/services/Husmann/Husmann/MapServer/'
            }
        },
        kulturminne: {
            api: KulturminneAPI,
            params: {
                brukerbilder: {
                    baseUrl: 'http://beta.ra.no/api/brukerbilder'
                },
                baseUrl: proxyUrl + 'http://kart.ra.no/arcgis/rest/services/Distribusjon/Kulturminner/MapServer/',
                imageApiBase: 'https://kulturminnebilder.ra.no',
                lokalitetImageTemplate: 'https://data.kulturminne.no/askeladden/lokalitet/<%= id %>',
                kulturmiljoImageTemplate: 'https://data.kulturminne.no/askeladden/kulturmiljo/K<%= id %>'
            }
        },
        utno: {
            api: UtnoAPI,
            params: {
                baseUrl: 'http://ut.no/tur/'
            }
        },
        folketelling: {
            api: FolketellingAPI,
            params: {
                baseUrl: 'http://api.digitalarkivet.arkivverket.no/v1/census/1910/'
            }
        },
        flickr: {
            api: FlickrAPI,
            extend: true,
            params: {
                baseUrl: 'https://api.flickr.com/services/rest/',
                imageTemplate: 'https://farm<%= farm %>.staticflickr.com/<%= server %>/<%= id %>_<%= secret %>_<%= size %>.jpg'
            }
        },
        kml: {
            api: KmlAPI,
            params: {proxyUrl: proxyUrl}
        },
        gpx: {
            api: GpxAPI,
            params: {proxyUrl: proxyUrl}
        },
        geojson: {
            api: GeoJsonAPI,
            params: {proxyUrl: proxyUrl}
        },
        lokalhistoriewiki: {
            api: LokalhistoriewikiAPI,
            params: {
                url: proxyUrl + 'http://lokalhistoriewiki.no/api.php',
                urlBase: 'http://lokalhistoriewiki.no/',
                imageBase: 'http://upload.wikimedia.org/wikipedia/commons/',
                maxRadius: 100000,
                blacklist: ['kjelder', 'kilder', 'eigedomar', 'eigedommar', 'galleri']
            }
        },
        jernbanemuseet: {
            api: JernbanemuseetAPI,
            extend: true,
            params: {
                lang: 'no',
                baseUrl: 'https://api.kulturpunkt.org/v2/owners/54',
                presentationUrl: 'https://api.kulturpunkt.org/v2/owners/54/presentations/'
            }
        },
        europeana: {
            api: EuropeanaAPI,
            extend: true,
            params: {
                baseUrl: 'http://www.europeana.eu/api/v2/search.json'
            }
        },
        ksamsok: {
            api: KSamsokAPI,
            extend: true,
            params: {
                proxyUrl: proxyUrl,
                baseUrl: proxyUrl + 'http://kulturarvsdata.se/ksamsok/api'
            }
        },
        brukerminner: {
            api: BrukerminnerAPI,
            params: {
                brukerbilder: {
                    baseUrl: 'http://beta.ra.no/api/brukerbilder'
                },
                baseUrl: 'http://beta.ra.no/api/'
            }
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
        bbox = splitBbox(bbox);

        var lng1 = bbox[0],
            lat1 = bbox[1],
            lng2 = bbox[2],
            lat2 = bbox[3];

        var centerLng = (lng1 + lng2) / 2;
        var centerLat = (lat1 + lat2) / 2;

        var radius = _.max([
            haversine(lat1, lng1, centerLat, centerLng),
            haversine(lat2, lng2, centerLat, centerLng)
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

    function getSublayer(dataset, callback, errorCallback) {
        var api = _getAPI(dataset.api);
        if (_.has(api, 'getSublayer')) {
            api.getSublayer(dataset, callback, errorCallback);
        } else if (errorCallback) {
            errorCallback('No getSublayer function for api ' + dataset.api);
        } else {
            throw new Error('No getSublayer function for api ' + dataset.api);
        }
    }

    return {
        getData: getData,
        getWithin: getWithin,
        getBbox: getBbox,
        getMunicipalityBounds: getMunicipalityBounds,
        getCountyBounds: getCountyBounds,
        getItem: getItem,
        getSublayer: getSublayer,
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

//KR.API.mappers = {};
