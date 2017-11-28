var KR = this.KR || {};

KR.BrukerminnerAPI = function (apiName) {
    'use strict';

    var URL = 'http://beta.ra.no/data/brukerminner.geojson';

    var cache = null;

    function getJson(callback) {
        if (cache !== null) {
            callback(null, cache);
        } else {
            var url = KR.Util.addCrossorigin(URL);


            var request = new XMLHttpRequest();
            request.responseType = "text";
            request.onload = function() {
                try {
                    callback(null, JSON.parse(this.response));
                } catch(e) {
                    callback(e, null);
                }
            }
            request.open("GET", url);
            request.send();
        }
    }


    function getData(dataset, callback, errorCallback) {
        //get all data, possibly filtered by a property in dataset
        getJson(function (err, data) {
            if (err) {
                errorCallback(err);
            } else {
                callback(data);
            }
        });
    }

    function getWithin(dataset, latLng, distance, callback, errorCallback, options) {
        callback();
    }

    function getBbox(dataset, bbox, callback, errorCallback, options) {
        callback();
    }

    function getItem(dataset, callback, errorCallback) {
        callback();
    }

    return {
        getData: getData,
        getWithin: getWithin,
        getBbox: getBbox,
        getItem: getItem
    };
};
