const fs = require( "fs" );
const _ = require( "lodash" );

const json1 = require( "./output.json" );
const json2 = require( "../src/sources/all_surah.json" );

const mergedJson = _.merge( json2, json1 );

fs.writeFileSync( "merged.json", JSON.stringify( mergedJson, null, 2 ) );
