import KnreiseAPI from '../src/index.js';
import L from 'leaflet';
L.Icon.Default.imagePath = '.';


L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png')
});



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

L.rectangle.fromBounds = function (bounds) {
    return L.rectangle([bounds.getSouthWest(), bounds.getNorthEast()]);
};




var bbox = '10.19531249999999,63.39152174400882,10.371093749999984,63.470144746565445';
var api = KnreiseAPI({});

var dataset = {
    api: 'wikipedia'
};

var map = L.map('map');
var bounds = L.latLngBounds.fromBBoxString(bbox);
map.fitBounds(bounds);

L.rectangle.fromBounds(bounds).addTo(map);

L.tileLayer('http://opencache.statkart.no/gatekeeper/gk/gk.open_gmaps?layers=norges_grunnkart_graatone&zoom={z}&x={x}&y={y}', {attribution: '&copy; <a href="http://kartverket.no">Kartverket</a>'}).addTo(map);


var c = { lat: 63.43083324528713, lng: 10.283203124999986 }
var r = 6183.9878774041135;

api.getWithin(dataset, c, r, function (data) {
    console.log('data', data);
    L.geoJson(data).addTo(map);

}, function (e) {
    console.error(e);
});
/*


api.getBbox(dataset, bbox, function (data) {
    console.log('data', data);
    L.geoJson(data).addTo(map);

}, function (e) {
    console.error(e);
});
*/



