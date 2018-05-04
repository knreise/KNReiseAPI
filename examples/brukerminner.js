import KNReiseApi from '../src/index.js';

var api = KNReiseApi({});

var dataset = {
    api: 'brukerminner'
};
var bbox = '8.889656,59.469152,9.216671,59.564071';

//var bbox = '1,50,10,60';
/*
api.getBbox(dataset, bbox, function (geoJson) {
    console.log("!!", geoJson);
}, console.error);
*/

var feature = {
  "_updated": "Fri, 30 Sep 2016 11:57:02 GMT",
  "properties": {
    "creator": {
      "type": "Person",
      "givenName": "Gunleiv",
      "familyName": "Brukås"
    },
    "tags": [
      "Teknisk/Industrielt minne"
    ],
    "name": "Gavlesjådammen.",
    "license": "https://creativecommons.org/licenses/by/4.0/deed.no",
    "description": "Beskrivelse: Steindamm.\n\nFint mura steindamm på begge sider av elva. Der er og steinmur litt lenger vest for oset. \n\nOpprinnelig funksjon: Industri, fremstilling, produksjon\n\nHistoriske opplysninger: Så tidleg som i 1731 er dammen nemnd i samband med tømmerdrift. Dammen har blitt utbedra og medernisert fleire gonger. I 1871 vart det oppført en \"skaatningsdam litt nedenfor den gamle dammen. I 1912 var der oppgradering av dammen. Siste gong dammen var ombygd og medernisert, var så seint som under siste krig.Den vart da bygd større og meir solid.Det vart da bruka ein god del betong. Sand til dette vart tekke frå strendene ved Gavlesjå.\nDammhytte var det på østsida av bekken, rett nedanfor dammen. \n\nDatering: 1700-tallet\n\nKilder: Lifjell i farne tider av Halvor Sem, side 73",
    "type": "CreativeWork",
    "url": "https://kulturminnesok.no/minne/?queryString=http://kulturminnesok.no/fm/gavlesjadammen",
    "contentLocation": {
      "type": "Place",
      "address": {
        "type": "PostalAddress",
        "addressRegion": "Telemark",
        "addressLocality": "Notodden"
      }
    },
    "uri": "http://kulturminnesok.no/fm/gavlesjadammen",
    "title": "Gavlesjådammen."
  },
  "_id": "6574b776a3aaef4bbad3a9bb576da260",
  "geometry": {
    "type": "Point",
    "coordinates": [
      8.945486674353942,
      59.53591154203939
    ]
  },
  "type": "Feature",
  "_etag": "f9914c4ca41d0fd0cae2882d10d44b8cac47f5ea",
  "_links": {
    "self": {
      "href": "brukerminner/6574b776a3aaef4bbad3a9bb576da260",
      "title": "brukerminner"
    }
  },
  "_created": "Fri, 30 Sep 2016 11:57:02 GMT",
  "id": "brukerminner_6574b776a3aaef4bbad3a9bb576da260"
};


var datasetWithFeature = {
    api: 'brukerminner',
    feature: feature
}

api.getItem(datasetWithFeature, console.log);

