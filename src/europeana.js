var KR = this.KR || {};

KR.EuropeanaAPI = function (apiName, options) {
    'use strict';

    options = options || {};
    var requests = [];

    var BASE_URL = 'http://www.europeana.eu/api/v2/search.json';
    var apikey = options.apikey;

    var queryTemplate = _.template('pl_wgs84_pos_lat:[<%= minLat %> TO <%= maxLat %>] AND pl_wgs84_pos_long:[<%= minLng %> TO <%= maxLng %>]');

    function _bboxQuery(bbox) {
        bbox = KR.Util.splitBbox(bbox);
        return queryTemplate({
            minLat: bbox[1],
            maxLat: bbox[3],
            minLng: bbox[0],
            maxLng: bbox[2]
        });
    }

    function _firstOrNull(arr) {
        if (arr && arr.length) {
            return arr[0];
        }
        return null;
    }

    function _createProperties(allProperties) {

        var thumbnail = _firstOrNull(allProperties.edmPreview);

        var title = _.has(allProperties.dcTitleLangAware, 'en') ? 
            allProperties.dcTitleLangAware['en'] :
            _.values(allProperties.dcTitleLangAware)[0];

        if (title) {
            title = title.join(' ');
        }
        var contentType = allProperties.type;

        return {
            thumbnail: thumbnail,
            images: [thumbnail],
            title: title,
            content: '',
            link: null,
            dataset: null,
            country: _firstOrNull(allProperties.country),
            contentType: allProperties.type,
            video: null,
            videoEmbed: null,
            sound: null,
            year: _firstOrNull(allProperties.year),
            license: _firstOrNull(allProperties.rights),
            source: allProperties.guid,
            provider: _firstOrNull(allProperties.dataProvider),
            creator: _firstOrNull(allProperties.dcCreator),
            dataProvider: _firstOrNull(allProperties.dataProvider),
            allProps: allProperties
        };
    }


    function _parseEuropeanaItem(item) {

        var lat = parseFloat(item.edmPlaceLatitude);
        var lng = parseFloat(item.edmPlaceLongitude);
        var id;
        if (_.has(item, 'id')) {
            id = apiName + '_' + item.id;
        }

        return KR.Util.createGeoJSONFeature(
            {
                lat: lat,
                lng: lng
            },
            _createProperties(item),
            id
        );
    }

    function _cursorQuery(params, callback, errorCallback) {

        var items = [];

        function gotResult(response) {
            items = items.concat(response.items);
            if (response.nextCursor) {
                _sendCursorQuery(params, response.nextCursor, gotResult, errorCallback);
            } else {
                callback(_parseItems({items: items}));
            }
        }

        _sendCursorQuery(params, '*', gotResult, errorCallback);

    }

    function _sendCursorQuery(params, cursor, callback, errorCallback) {
        params.cursor = cursor;
        var url = BASE_URL + '?'  + KR.Util.createQueryParameterString(params);
        KR.Util.sendRequest(url, null, callback, errorCallback);
    }


    function _parseItems(response) {
        var features = _.map(response.items, _parseEuropeanaItem);
        return KR.Util.createFeatureCollection(features);
    }

    function getBbox(parameters, bbox, callback, errorCallback, options) {
        var params = {
            wskey: apikey,
            query: _bboxQuery(bbox)
        };
        if (parameters.collection) {
            params.qf = 'europeana_collectionName:' + parameters.collection;
        } else if (parameters.query) {
            params.qf = parameters.query;
        }

        _cursorQuery(params, callback, errorCallback);
    }

    function getWithin(parameters, latLng, distance, callback, errorCallback, options) {
        /*
        var params = {
            pt: _formatLatLng(latLng),
            d: distance / 1000 // convert to km
        };
        _get(params, parameters, callback, errorCallback, options);
        */
    }

    function getData(parameters, callback, errorCallback, options) {
        /*
        if (parameters.query && _.isArray(parameters.query)) {
            var query = 'delving_spec:' + parameters.dataset +
                ' AND (' + parameters.query.join(' OR ') + ')' +
                ' AND delving_hasGeoHash:true';
            var params = {
                query: query,
                format: 'json',
                rows: 1000
            };

            var requestId = query;
            _checkCancel(requestId);

            var url = BASE_URL + '?'  + KR.Util.createQueryParameterString(params);
            if (options.allPages) {
                requests[requestId] = _getAllPages(url, callback, errorCallback);
            } else {
                requests[requestId] = _getFirstPage(url, callback, errorCallback);
            }
            return;
        }
        _get({}, parameters, callback, errorCallback, options);
        */
    }

    function getItem() {

    }

    return {
        getWithin: getWithin,
        getItem: getItem,
        getBbox: getBbox,
        getData: getData
    };
};
