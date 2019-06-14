#! /usr/bin/env node


console.log(`
  ******************************************************
  xp116-import-yaml-museum.js
  ******************************************************
  `)

const fs = require('fs-extra');
const path = require('path');
const assert = require('assert');
const yaml = require('js-yaml');
const jsonfile = require('jsonfile');
const writeJsonFile = require('write-json-file');
const object_hash = require('node-object-hash')();
// const find = require(`find-file-sync`);
const find = require('find');
//var find = require('find-promise');
//const pdfjsLib = require('pdfjs-dist');

const api = require('../207-jpc-catalogs-admin/lib/openacs-api')
const {_assert, __assert} = require('../207-jpc-catalogs-admin/lib/openacs-api');
const {xnor1, xnor2, xnor3} = require('./lib/utils')
//const {scan_extlink, remove_unchanged} = require('./lib/scan-extlink.js');
//const {retrofit_for_update} = require('./lib/scan-extlink.js');
//const {commit_catalog, commit_section_pdf, commit_edition} = require('../207-jpc-catalogs-admin/lib/openacs-api/commit-revision-v2.js')
const {commit_catalog} = require('./lib/commit-catalog.js')
const {split_pdf_raw_text, pdf_lookup, pdf_findSync} = require('./lib/pdf-split.js');
const {preflight} = require('./lib/preflight-yaml.js');

const argv = require('yargs')
  .alias('v','verbose').count('verbose')
  .alias('f','force_commit') // even if checksum unchanged
  .alias('g','force_phase2')
  .alias('i','instance_name')
//  .alias('o','output')
  .boolean('pg-monitor')
  .boolean('commit')
  .boolean('force_commit') // going into phase2 even if errors.
  .options({
    'pg-monitor': {default:false},
    'limit': {default:99999}, // stop when error, if --no-stop, show error.
//    'zero-auteurs': {default:false}, //
  }).argv;

const {verbose, instance_name, force_commit, force_phase2} = argv;

const pg_monitor = (verbose>1);
const fn = argv._[0];
//const pdf_root_folder = '/home/dkz/tmp/new-pdf-and-jpg-20190425';
const pdf_root_folder = '/media/dkz/Seagate/2019-museum-assets';
const pdf_folders = [
  '/media/dkz/Seagate/2019-museum-assets/pdf-www',
  '/media/dkz/Seagate/2019-museum-assets/new-pdf-and-jpg-20190425'
];

if (!fs.existsSync(fn)) {
  console.log(`
    FATAL : file-not-found <${fn}>
    `);
  process.exit(-1);
}

const yaml_data = yaml.safeLoad(fs.readFileSync(fn, 'utf8'));

const {_constructeurs,
_products,
_marques,
_auteurs,
v1_errors,
pdf_missedCount,
pdf_totalCount,
near_missCount} = preflight(yaml_data, {
  pdf_folders
});

/*
yaml_data.forEach(it =>{
  const {object_type, xid} = it;
  switch(object_type) {
    case 'catalog':
    console.log(`-- catalog xid:${xid}`);
    break;
  }
})
*/

//writeJsonFile.sync('1.json',yaml_data); process.exit(-1);

console.log(`found ${Object.keys(_products).length} products`)
console.log(`found ${Object.keys(_marques).length} marques`)
console.log(`found ${Object.keys(_auteurs).length} auteurs`)
console.log(`found ${Object.keys(_constructeurs).length} constructeurs`)
console.log(`pdf_missedCount: ${pdf_missedCount}:${pdf_totalCount} found:${pdf_totalCount-pdf_missedCount}`)

if (v1_errors >0) {
  //console.log(yaml_data)
  console.log(`found ${v1_errors} errors in validations phase-1`);
  if (!force_phase2) {
    console.log(`
      ****************************************
      FIX errors before proceeding to phase-2
      or use flag "-g" (force-phase2)
      exit.
      ****************************************
      `)
    process.exit(-1)
  }
} else {
  console.log(`validation V1 passed.`);
};



if (!instance_name) {
  console.log(`
    ******************************
    FATAL : MISSING INSTANCE NAME
    use "-i <instance-name>"
    exit.
    ******************************
    `)
  process.exit(-1)
}

if (verbose) {
  for (let it of yaml_data) {
    const {xid, title} = it;
    if (it.object_type == 'catalog') {
      const {catalog:title, path, xid, indexNames, co, ci, sa, yp, pic, products, marques, links} = it;
      it.links && it.links.forEach((link) =>{
        link.error && console.log(`-- missed pdf "${link.fn}"`)
      }); // each link
    } // each catalog
  } // each item
} // berbose


console.dir(`Connect database - switching async mode.`)

main()
.then(async ()=>{
})
.catch((err)=>{
  console.log('fatal error in main - err:',err);
  api.close_connection()
  console.dir('Closing connection - Exit: AFTER FAIL.');
})


async function main() {
  const {db} = await api.connect({pg_monitor});

  await db.query(`
    select * from cms.app_instances where instance_name = $1;
    `, [instance_name], {single:false})
  .then(apps =>{
    if (apps.length == 1) {
      // GLOBAL VARIABLE with db
      app = apps[0]; // global.
      verbose && console.log(`found app:`,app)
      app.db = db;
    } else {
      console.log(`found ${apps.length} apps:`,apps)
      throw 'stop@100';
    }
  })


  console.log(`Connected to instance:${app.package_id} <${instance_name}>`);


  /***********************************************
      DB SNAP-SHORT to reduce db accesses.
      HERE: app has {package_id, app-folder}
      Lets get a directory (snap-shot)
      to reduce access to db.
  ************************************************/

  // global.
  gdir = await db.query(`
  select
    parent_id, name, description,
    object_type, title,
    item_id, revision_id, name, path,
    data->>'xid' as xid
  from cms.revisions_latest
  where (package_id = $1) and (object_type = 'catalog')
  order by name;
  `, [app.package_id], {single:false});

  if (!gdir) {
    console.log(`
      Unable to access app data.
      `)
    process.exit(-1);
  }

  /******************************

  Create an index(xid) => checksum

  *******************************/
  const _gdir ={};

  console.log(`found ${gdir.length} items from openacs app-folder:${app.folder_id}`)
 //console.log(gdir);
  true && gdir.forEach(it =>{
    const {item_id, revision_id, object_type, title, description:latest_checksum, name} = it;
    const xid = +(name.replace('catalog-',''))
    _gdir[name] = latest_checksum;
    verbose &&
    console.log(`[${revision_id}] (${name}) => (${latest_checksum}) ${title}`);
  });

  //_assert(Object.keys(_gdir) == gdir.length, '', 'fatal@288');

  const otypes = {}; // cache

  let constructeur_ctx =null;

  err_Count =0;
  for (let it of yaml_data) {
    const {xid, title, name} = it;

    switch(it.object_type) {
      case 'catalog':
      const {marques, products, links, name} = it;
//console.log(it)
      _assert(it.title, it, "Missing title")
      Object.assign(it, {
        lang: 'french', // should come from data
//        name: 'catalog-'+xid,
        data: {marques, products, links},
        description: null
      })
      const new_checksum = object_hash.hash(it);
      const latest_checksum = (force_commit)? '3.1416xxxxknuth' : _gdir[name];

      if (latest_checksum == new_checksum) {
        verbose &&
        console.log(`-- (${name}) => checksum[${latest_checksum}] unchanged. do-nothing.`)
        it.description = latest_checksum; // restore...
        continue;
      } else {
        verbose &&
        console.log(`-- (${name}) => checksum[${latest_checksum}] => [${new_checksum}] (new-checksum)`)
      }
      it.description = new_checksum;

      //console.log(it)
      await commit_catalog(it);
      break;

      case 'constructeur':
      break;

      case 'marque':
      break;

      case 'auteur':
      break;

      case 'product':
      break;

      case 'keyword':
      break;

      case 'article':
      break;

      default:
      console.log(`NOT-READY: it:`,it)
    } // switch

  } // each item in Yaml.

  console.log(`done processing ${yaml_data.length} items in YAML err_Count:${err_Count}`)

  // -------------------------------------------------------------------------

  await api.close_connection(db)
  console.dir('Closing connection - Exit: Ok.')
} // main

// -------------------------------------------------------------------------


// -------------------------------------------------------------------------

function find_path(path) {
  gdir.forEach(it =>{
    if (it.path == path) return it;
  })
}
