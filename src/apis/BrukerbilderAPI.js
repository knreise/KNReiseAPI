import * as _ from 'underscore';

import sendRequest from '../util/sendRequest';

export default function BrukerbilderAPI(options) {

    var URL_BASE = options.baseUrl;

    function _parser(data) {
        return _.map(data._items, function (item) {
            return {
                type: 'brukerbilde',
                description: item.description,
                creator: item.photographer,
                license: item.license,
                image: `${item.contentUrl}?fitIn=400x400`,
                fullsize: item.contentUrl
            };
        });

    }

    function getImages(id, callback, errorCallback, options) {
        var query = JSON.stringify({'heritageId': id});
        var url = `${URL_BASE}?where=${query}`;
        return sendRequest(url, _parser, callback, errorCallback);
    }

    return {
        getImages: getImages
    };
};
