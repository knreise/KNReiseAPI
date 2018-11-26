import FileAPI from './FileAPI';

export default function GeoJsonAPI(apiName, options) {
    function parser(data) {
        return JSON.parse(data);
    }
    return FileAPI(apiName, {parser: parser, proxyUrl: options.proxyUrl});
};
