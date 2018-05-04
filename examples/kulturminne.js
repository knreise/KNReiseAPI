import KNReiseApi from '../src/index.js';

var api = KNReiseApi({});

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
    feature: {properties: {LokalitetID: 166042}}
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

api.getItem(kulturminneItemMedBrukerbilde, function (data) {
    console.log('bilder for lokalitet', data);

}, function (e) {
    console.error(e);
});

api.getItem(kulturminneItem, function (data) {
    console.log('bilder for lokalitet', data);

}, function (e) {
    console.error(e);
});

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
