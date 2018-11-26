import toGeoJSON from '@mapbox/togeojson';
import FileAPI from './FileAPI';

export default function KmlAPI(apiName, options) {
    function parser(data) {
        return toGeoJSON.kml(data);
    }
    return FileAPI(apiName, {parser: parser, proxyUrl: options.proxyUrl});
};
