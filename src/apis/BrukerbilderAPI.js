import * as _ from 'underscore';

import sendRequest from '../util/sendRequest';

export default function BrukerbilderAPI() {

    var URL_BASE = 'http://beta.ra.no/api/brukerbilder';

    function _parser(data) {
        return _.map(data._items, function (item) {
            return {
                type: 'brukerbilde',
                description: item.description,
                creator: item.photographer,
                license: item.license,
                image: `${item.contentUrl}?fitIn=400x400`
            };
        });

    }

    function getImages(id, callback, errorCallback, options) {
        console.log(id);
        var query = JSON.stringify({'heritageId': id});
        console.log(query)
        var url = `${URL_BASE}?where=${query}`;
        console.log(url)
        return sendRequest(url, _parser, callback, errorCallback);
    }

    return {
        getImages: getImages
    };
};
