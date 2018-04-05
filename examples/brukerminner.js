import KNReiseApi from '../src/index.js';

var api = KNReiseApi({});

var dataset = {
    api: 'brukerminner'
};
var bbox = '8.889656,59.469152,9.216671,59.564071';

//var bbox = '1,50,10,60';

api.getBbox(dataset, bbox, function (geoJson) {
    console.log("!!", geoJson);
}, console.error);