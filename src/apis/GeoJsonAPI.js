import FileAPI from './FileAPI';

export default function GeoJsonAPI(apiName) {
    function parser(data) {
        return JSON.parse(data);
    }
    return FileAPI(apiName, {parser: parser});
};
