import KNReiseApi from '../src/index.js';

var api = KNReiseApi({});

var kulturminne = {api: 'kulturminne', dataset: 'lokaliteter'};
var kulturmiljo = {api: 'kulturminne', dataset: 'kulturmiljoer'};


var bbox = '10.749607086181639,59.91590263019011,10.759949684143066,59.922355662817154';

api.getBbox(kulturminne, bbox, function (data) {
    console.log('!', data);

}, function (e) {
    console.error(e);
});


api.getBbox(kulturmiljo, bbox, function (data) {
    console.log('!!!!', data);

}, function (e) {
    console.error(e);
});


var kulturminneItem = {api: 'kulturminne', dataset: 'lokaliteter', feature: {properties: {LokalitetID: 16692}}};

/*
api.getItem(kulturminneItem, function (data) {
    console.log('!!', data);

}, function (e) {console.error(e);});
*/

api.getSublayer(kulturminneItem, function (data) {
    console.log('!!!', data);
}); 
