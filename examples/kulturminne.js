import KNReiseApi from '../src/index.js';
import L from 'leaflet';

import * as _ from 'underscore';

//adapted from http://www.maptiler.org/google-maps-coordinates-tile-bounds-projection/

function GlobalMercator() {

    var originShift = 2 * Math.PI * 6378137 / 2.0;
    var tileSize = 512;
    var initialResolution = 2 * Math.PI * 6378137 / tileSize;

    function Resolution(zoom) {
        return initialResolution / Math.pow(2, zoom);
    }

    function PixelsToTile(px, py) {
        var tx = parseInt(Math.ceil( px / parseFloat(tileSize) ) - 1, 10);
        var ty = parseInt(Math.ceil( py / parseFloat(tileSize) ) - 1, 10);
        return {tx: tx, ty: ty};
    }


    function MetersToPixels(mx, my, zoom) {
        var res = Resolution(zoom);
        var px = (mx + originShift) / res;
        var py = (my + originShift) / res;
        return {px: px, py: py};
    }

    function PixelsToMeters(px, py, zoom) {
        var res = Resolution(zoom);
        var mx = px * res - originShift;
        var my = py * res - originShift;
        return {x: mx, y: my};
    }

    function TileBounds(tx, ty, zoom) {
        var min = PixelsToMeters(tx * tileSize, ty * tileSize, zoom );
        var max = PixelsToMeters((tx + 1) * tileSize, (ty + 1) * tileSize, zoom );
        return [min.x, min.y, max.x, max.y];
    }

    function LatLonToMeters(lat, lon) {

        var mx = lon * originShift / 180.0;
        var my = Math.log(Math.tan((90 + lat) * Math.PI / 360.0 )) / (Math.PI / 180.0);

        my = my * originShift / 180.0;
        return {mx: mx, my: my};
    }

    function MetersToLatLon(mx, my) {
        var lon = (mx / originShift) * 180.0;
        var lat = (my / originShift) * 180.0;

        lat = 180 / Math.PI * (2 * Math.atan(Math.exp( lat * Math.PI / 180.0)) - Math.PI / 2.0);
        return {lat: lat, lon: lon};
    }

    function MetersToTile(mx, my, zoom) {
        var p = MetersToPixels(mx, my, zoom);
        return PixelsToTile(p.px, p.py);
    }

    function TileLatLonBounds(tx, ty, zoom) {
        var bounds = TileBounds(tx, ty, zoom);
        var min = MetersToLatLon(bounds[0], bounds[1]);
        var max = MetersToLatLon(bounds[2], bounds[3]);
        return [min.lat, min.lon, max.lat, max.lon];
    }

    return {
        LatLonToMeters: LatLonToMeters,
        MetersToTile: MetersToTile,
        TileLatLonBounds: TileLatLonBounds
    };
}



function getTiles(zoomlevel, lat, lon, latmax, lonmax) {
    var tz = zoomlevel;
    var mercator = GlobalMercator();
    var minM = mercator.LatLonToMeters(lat, lon);
    var tmin = mercator.MetersToTile(minM.mx, minM.my, tz);

    var maxM = mercator.LatLonToMeters(latmax, lonmax);
    var tmax = mercator.MetersToTile(maxM.mx, maxM.my, tz);
    var res = [];
    for (var ty = tmin.ty; ty <= tmax.ty; ty++) {
        for (var tx = tmin.tx; tx <= tmax.tx; tx++) {
            res.push({tz: tz, ty: ty, tx: tx});
        }
    }
    return res;
}

function getTiles2(bounds, startZoom) {
    //var bounds = L.latLngBounds.fromBBoxString(bbox);
    var sw = bounds.getSouthWest();
    var ne = bounds.getNorthEast();

    var tiles;
    for (var zoom = startZoom || 6; zoom <= 14; zoom++) {
        tiles = getTiles(zoom, sw.lat, sw.lng, ne.lat, ne.lng);
    }
    var mercator = GlobalMercator();
    var res = [];
    for (var i = 0; i < tiles.length; i++) {
        var t = tiles[i];
        var tileBounds = mercator.TileLatLonBounds(t.tx, t.ty, t.tz);
        res.push([tileBounds[1], tileBounds[0], tileBounds[3], tileBounds[2]].join(','));
    }
    return res;
}





function splitBbox(bbox) {
    return bbox.split(',').map(parseFloat);
};

L.latLngBounds.fromBBoxArray = function (bbox) {
    return new L.LatLngBounds(
        new L.LatLng(bbox[1], bbox[0]),
        new L.LatLng(bbox[3], bbox[2])
    );
};

L.latLngBounds.fromBBoxString = function (bbox) {
    return L.latLngBounds.fromBBoxArray(splitBbox(bbox));
};

L.rectangle.fromBounds = function (bounds, color) {
    return L.rectangle([bounds.getSouthWest(), bounds.getNorthEast()], {color: color || "#ff7800", weight: 1});
};

var api = KNReiseApi({});

function addData(dataset, bounds, color) {
    L.rectangle.fromBounds(bounds).addTo(map);
    api.getBbox(dataset, bbox, function (data) {
        console.log('data', data);
        L.geoJson(data, {color: color, weight: 2}).addTo(map);

    }, function (e) {
        console.error(e);
    });

}

function createFeatureCollection(features) {
    return {
        'type': 'FeatureCollection',
        'features': features
    };
}


function loadBboxTiled(dataset, bounds, color) {
    
    var tileBounds = getTiles2(bounds, dataset.minZoom);
    console.log(tileBounds)
    var res = [];
    var errors = [];
    var finished = _.after(tileBounds.length, function () {
        
        if (errors.length) {
            //callback(errors);
            console.log(errors)
        } else {
            var features = _.flatten(_.map(res, r=> r.features));
            
            var filteredFeatures = _.chain(features)
                .map(f => f.id)
                .uniq()
                .map(id => _.find(features, f => f.id === id))
                .value();
            

            console.log(filteredFeatures.length);


            /*
            var features = createFeatureCollection();
            var ids = _.map(features.features)
            */

            L.geoJson(filteredFeatures, {color: color, weight: 2}).addTo(map);
            //callback(null, filter(L.latLngBounds.fromBBoxString(bbox), features));
        }
    });

    _.each(tileBounds, function (tileBound) {
            L.rectangle.fromBounds(L.latLngBounds.fromBBoxString(tileBound)).addTo(map);
            api.getBbox(
                dataset,
                tileBound,
                function (data) {
                    res.push(data);
                    finished();
                },
                function (error) {
                    errors.push(error);
                    finished();
                },
                {checkCancel: false}
            );
    });
}



var kulturminne = {
    api: 'kulturminne',
    dataset: 'lokaliteter'
};


var bbox = '10.708494186401367,59.887558969026216,10.749692916870115,59.899248010637166';
var map = L.map('map');
L.tileLayer('http://opencache.statkart.no/gatekeeper/gk/gk.open_gmaps?layers=norges_grunnkart_graatone&zoom={z}&x={x}&y={y}', {attribution: '&copy; <a href="http://kartverket.no">Kartverket</a>'}).addTo(map);
var bounds = L.latLngBounds.fromBBoxString(bbox);
map.fitBounds(bounds, {padding: [10, 10]});


L.rectangle.fromBounds(bounds, "#00ff00").addTo(map);



//addData(kulturminne, bounds, '#ff0000');
loadBboxTiled(kulturminne, bounds, '#ff0000');







/*
var bbox = '10.749607086181639,59.91590263019011,10.759949684143066,59.922355662817154';
var kulturminne = {
    api: 'kulturminne',
    dataset: 'lokaliteter',
    //query: 'LokalitetskategoriID IN (\'L-ARK\')'
};

var kulturminneItem = {
    api: 'kulturminne',
    dataset: 'lokaliteter',
    feature: {properties: {LokalitetID: 88460}}
};

var kulturminneItemMedBrukerbilde = {
    api: 'kulturminne',
    dataset: 'lokaliteter',
    feature: {properties: {LokalitetID: 86685}}
};

var kulturmiljo = {api: 'kulturminne', dataset: 'kulturmiljoer'};
var kulturmiljoItem = {
    api: 'kulturminne',
    dataset: 'kulturmiljoer',
    feature: {properties: {KulturmiljoID: 122}}
};

var enkeltminneItem = {
    api: 'kulturminne',
    dataset: 'enkeltminner',
    feature: {properties: {KulturminneID: '158591-1'}}
};
*/
/*
api.getBbox(kulturminne, bbox, function (data) {
    console.log('lokaliteter', data);

}, function (e) {
    console.error(e);
});
*/
/*
api.getBbox(kulturmiljo, bbox, function (data) {
    console.log('kulturmiljøer', data);

}, function (e) {
    console.error(e);
});
*/
/*
api.getItem(kulturminneItem, function (data) {
    //console.log('bilder for lokalitet', data);
    console.log(JSON.stringify(data, null, 4));

}, function (e) {
    console.error(e);
});
*/
/*
api.getItem(kulturminneItem, function (data) {
    console.log('bilder for lokalitet', data);

}, function (e) {
    console.error(e);
});
*/
/*
api.getSublayer(kulturminneItem, function (data) {
    console.log('Enkeltminner for lokalitet', data);
});
*/
/*
api.getItem(kulturmiljoItem, function (data) {
    console.log('bilder for kulturmiljø', data);

}, function (e) {
    console.error(e);
});
*/
/*
api.getItem(enkeltminneItem, function (data) {
    console.log('bilder for enkeltminne', data);

}, function (e) {
    console.error(e);
});
*/
