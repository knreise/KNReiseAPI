import * as _ from 'underscore';

function createGeoJSONFeature(latLng, properties, id) {
    properties = properties || {};
    return {
        'type': 'Feature',
        'geometry': {
            'type': 'Point',
            'coordinates': [latLng.lng, latLng.lat]
        },
        'properties': properties,
        'id': id
    };
}

function createFeatureCollection(features) {
    return {
        'type': 'FeatureCollection',
        'features': features
    };
};

function createQueryParameterString(params) {
    return _.map(params, function (value, key) {
        return encodeURIComponent(key) + '=' + encodeURIComponent(value);
    }).join('&');
};

function splitBbox(bbox) {
    return bbox.split(',').map(parseFloat);
};

function _toRad(value) {
    return value * Math.PI / 180;
}

function haversine(lat1, lon1, lat2, lon2) {
    var R = 6371000; // metres
    var phi1 = _toRad(lat1);
    var phi2 = _toRad(lat2);
    var bDeltaPhi = _toRad(lat2 - lat1);
    var bDeltaDelta = _toRad(lon2 - lon1);

    var a = Math.sin(bDeltaPhi / 2) * Math.sin(bDeltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(bDeltaDelta / 2) * Math.sin(bDeltaDelta / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

function createGeoJSONFeatureFromGeom(geom, properties, id) {
    properties = properties || {};
    return {
        'type': 'Feature',
        'geometry': geom,
        'properties': properties,
        'id': id
    };
};

function dictWithout(dict) {
    var keys = _.without(_.keys(dict), Array.prototype.slice.call(arguments, 1));
    return _.reduce(keys, function (acc, key) {
        acc[key] = dict[key];
        return acc;
    }, {});
};

function addCrossorigin(url, proxyUrl) {
    if (url.indexOf(proxyUrl) !== 0) {
        return proxyUrl + url;
    }
    return url;
};

export {
    createGeoJSONFeature,
    createGeoJSONFeatureFromGeom,
    createFeatureCollection,
    createQueryParameterString,
    splitBbox,
    dictWithout,
    haversine,
    addCrossorigin
};