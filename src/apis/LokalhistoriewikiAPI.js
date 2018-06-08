import * as _ from 'underscore';

import wtf from 'wtf_wikipedia';

import sendRequest from '../util/sendRequest';
import handleError from '../util/handleError';
import {
    createGeoJSONFeature,
    createFeatureCollection,
    createQueryParameterString
} from '../util';

import {
    createGetBbox,
    createGetWithin,
    wikiGeneratorQuery
} from './mediawikiCommon';




export default function WikipediaAPI(apiName, options) {
    var MAX_RADIUS = options.maxRadius || 10000;
    var BASE_URL = options.url;
    var urlBase = options.urlBase;
    var BLACKLIST = options.blacklist || [];

    function _getLokalhistorieDetails(pageIds, callback) {

        //this is a bit strange, we use a genrator for extraxts and pageImages,
        //but since the API limits response length we'll have to repeat it
        //see wikiGeneratorQuery
        var params = {
            action: 'query',
            prop: 'revisions',
            rvprop: 'content',
            exlimit: 'max',
            exintro: '',
            pilimit: 'max',
            pageids: pageIds,
            format: 'json',
            'continue': ''
        };
        wikiGeneratorQuery(BASE_URL, params, callback);
    }

    function _getThumbnails(text) {
        const file_reg = new RegExp('{{thumb(.*)}}', 'i');
        var res = text.match(file_reg);
        if (res === null) {
            return [];
        }
        return _.map(_.rest(res), m => {
            var s = m.split('|');
            var filename = s[1].replace(/ /g, '_');

            var year = null;
            var creator = null;
            if (s.length > 3) {
                creator = s[3].replace(/\[/g, '').replace(/\]/g, '');
            }
            if (s.length > 4) {
                year = s[4];
            }

            return {
                type: 'wiki_image',
                description: s[2],
                year: year,
                creator: creator,
                image: `${urlBase}/images/thumb/${encodeURIComponent(filename)}/350px-${encodeURIComponent(filename)}`,
                fullsize: `${urlBase}/images/${encodeURIComponent(filename)}`,
                href: `${urlBase}/wiki/Fil:${encodeURIComponent(filename)}`
            };
        });
    }

    function _getImages(wikiImages) {
        return [];
    }


    function parseLokalhistorieItem(item, extra) {
        var extraData = {};
        if (extra && _.has(extra, 'revisions')) {
            var wikitext = extra.revisions[0]['*'];
            var doc = wtf(wikitext);
            extraData.media = _getThumbnails(wikitext).concat(_getImages(doc.images()));
            extraData.thumbnail = extraData.media.length > 0
                ? extraData.media[0].image
                : null;


            var text = _.chain(doc.sections())
                .filter(s => {
                    return BLACKLIST.indexOf(s.title().toLowerCase()) === -1;
                }).map(s => `${s.title()}\n${s.plaintext()}`)
                .value()
                .join('\n\n');

            extraData.text = text;
        }
        var link = `${urlBase}?curid=${item.pageid}`;
        var params = {
            title: item.title,
            link: link,
            id: item.pageid
        };

        return createGeoJSONFeature(
            {lat: item.lat, lng: item.lon},
            _.extend({}, params, extraData),
            apiName + '_' + item.pageid
        );

    }


    function parseLokalhistorieItems(response, callback, errorCallback) {
        try {
            response = JSON.parse(response);
        } catch (ignore) {}


        try {
            //since the wikipedia API does not include details, we have to ask for 
            //them seperately (based on page id), and then join them
            var pageIds = _.pluck(response.query.geosearch, 'pageid');

            if (!pageIds.length) {
                callback(createFeatureCollection([]));
            } else {
                _getLokalhistorieDetails(pageIds.join('|'), function (pages) {
                    var features = _.map(response.query.geosearch, function (item) {
                        var extra = _.has(pages, item.pageid)
                            ? pages[item.pageid]
                            : null;
                        return parseLokalhistorieItem(item, extra);
                    });
                    callback(createFeatureCollection(features));
                });
            }
        } catch (error) {
            handleError(errorCallback, error);
        }
    }


    var getBbox = createGetBbox(parseLokalhistorieItems, BASE_URL, MAX_RADIUS);
    var getWithin = createGetWithin(parseLokalhistorieItems, BASE_URL, MAX_RADIUS);

    return {
        getBbox: getBbox,
        getWithin: getWithin
    };
};
