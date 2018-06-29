import * as _ from 'underscore';
import handleError from './handleError';
import $ from 'jquery';

$.ajaxTransport('+binary', function (options, originalOptions, jqXHR) {
    // check for conditions and support for blob / arraybuffer response type
    if (window.FormData && ((options.dataType && (options.dataType === 'binary')) || (options.data && ((window.ArrayBuffer && options.data instanceof ArrayBuffer) || (window.Blob && options.data instanceof Blob))))) {
        return {
            // create new XMLHttpRequest
            send: function (headers, callback) {
                // setup all variables
                var xhr = new XMLHttpRequest(),
                url = options.url,
                type = options.type,
                async = options.async || true,
                // blob or arraybuffer. Default is blob
                dataType = options.responseType || 'blob',
                data = options.data || null,
                username = options.username || null,
                password = options.password || null;
                xhr.addEventListener('load', function () {
                    var data = {};
                    data[options.dataType] = xhr.response;
                    // make callback and send data
                    callback(xhr.status, xhr.statusText, data, xhr.getAllResponseHeaders());
                });

                xhr.open(type, url, async, username, password);

                // setup custom headers
                for (var i in headers ) {
                    xhr.setRequestHeader(i, headers[i] );
                }

                xhr.responseType = dataType;
                xhr.send(data);
            },
            abort: function () {
                jqXHR.abort();
            }
        };
    }
});

export default function sendRequest(url, parser, callback, errorCallback,
                                    headers, method, ajaxOpts) {
    ajaxOpts = ajaxOpts || {};
    headers = headers || {};

    var ajaxRequest = {
        method: method || 'get',
        beforeSend: function (request) {
            _.each(headers, function (value, key) {
                request.setRequestHeader(key, value);
            });
        },
        url: url,
        success: function (response) {
            if (parser) {
                var parsed;
                try {
                    parsed = parser(response, errorCallback);
                } catch (e) {
                    handleError(errorCallback, e.message, response);
                    return;
                }
                if (!_.isUndefined(parsed)) {
                    callback(parsed);
                }
            } else {
                callback(response);
            }
        },
        error: function (err) {
            if (errorCallback) {
                errorCallback(err);
            } else {
                console.error(err);
            }

        }
    };

    return $.ajax(_.extend(ajaxRequest, ajaxOpts));
}