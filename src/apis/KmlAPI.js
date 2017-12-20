import toGeoJSON from '@mapbox/togeojson';
import FileAPI from './FileAPI';

export default function KmlAPI(apiName) {
    function parser(data) {
        return toGeoJSON.kml(data);
    }
    return FileAPI(apiName, {parser: parser});
};
