import toGeoJSON from '@mapbox/togeojson';
import FileAPI from './FileAPI';

export default function GpxAPI(apiName, options) {
    function parser(data) {
        return toGeoJSON.gpx(data);
    }
    return FileAPI(apiName, {parser: parser, proxyUrl: options.proxyUrl});
};
