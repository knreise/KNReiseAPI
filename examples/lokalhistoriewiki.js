import KnreiseAPI from '../src/index.js';

var api = KnreiseAPI({});

var dataset = {
    api: 'lokalhistoriewiki'
};
var bbox = '8.889656,59.469152,9.216671,59.564071';

api.getBbox(dataset, bbox, function (data) {
    console.log('data', data);

}, function (e) {
    console.error(e);
});



