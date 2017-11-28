var KR = this.KR || {};

KR.KulturminneAPI = function (apiName) {
    'use strict';

    var baseAPI = KR.ArcgisAPI('kulturminne', {url: 'http://kart.ra.no/arcgis/rest/services/Distribusjon/Kulturminner/MapServer/'});

    function getBbox(dataset, bbox, callback, errorCallback) {
        baseAPI.getBbox(dataset, bbox, callback, errorCallback)
    }

    return {
        getBbox: getBbox
    };
};
