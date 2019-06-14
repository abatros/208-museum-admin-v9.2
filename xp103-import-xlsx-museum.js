#! /usr/bin/env node


console.log(`
  **********************************************
  xp103-import-xlsx-museum.js
  - convert to yaml/sequential.
  - create pseudo-extlink for each catalog (pdf-file)
  **********************************************
  `)

const fs = require('fs-extra');
const path = require('path');
const assert = require('assert');
const writeJsonFile = require('write-json-file');
const loadJsonFile = require('load-json-file');
const yaml = require('js-yaml');
const {xnor1, xnor2, xnor3} = require('./lib/utils')


const {api,_assert, __assert} = require('../207-jpc-catalogs-admin/lib/openacs-api')


//const {_assert, fatal_error} = require('./lib/openacs-api');
//const xlsx_fn = '0-Heating-Museum-from-start-to-31-Mars-2019-FRENCN-20190425.xlsx';


const argv = require('yargs')
  .alias('v','verbose').count('verbose')
  .alias('o','output')
  .boolean('pg-monitor')
  .boolean('commit')
  .options({
    'pg-monitor': {default:true},
    'limit': {default:99999}, // stop when error, if --no-stop, show error.
    'zero-auteurs': {default:false}, //
  }).argv;

const {verbose, output} = argv;
const pg_monitor = (verbose>1);
const xlsx_fn = argv._[0];

if (!xlsx_fn) {
  console.log(`
    ************************************************
    FATAL : Missing input file
    ./xp103-import-xlsx-museum.js <input-file.xlsx>
    ************************************************
    `);
  process.exit(-1);

}

if (!fs.existsSync(xlsx_fn)) {
  console.log(`
    FATAL : Missing input file <${xlsx_fn}>
    `);
  process.exit(-1);
}


const xlsx = require('./lib/xlsx2json.js')(xlsx_fn); // an array.
console.log(`1. xlsx file contains ${xlsx.length} rows.`);

if (xlsx.length <=0) console.log(xlsx)
_assert(xlsx.length >0, xlsx, "!!!!")

const {alerts} = require('./lib/reformat.js')(xlsx);
console.log(`2. reformat reporting ${alerts.length} errors:`);
verbose &&
alerts.forEach(it=>console.log(it))

//fs.writeFileSync(xlsx_fn.replace('.xlsx','.json'), yaml.join('\n'));

xlsx.forEach((row,i) =>{
  //xlsx[i].indexNames = ['xyzzzzzzzzzzzzz']; //iname.replace('a','o')

  row.indexNames && row.indexNames.forEach((iname,j) =>{
    row.indexNames[j] = iname.replace('\u00A0',' ')
  })
})

writeJsonFile.sync(xlsx_fn.replace('.xlsx','.json'), xlsx)
/*
const xlsx2 = loadJsonFile.sync(xlsx_fn.replace('.xlsx','.json'))
*/
const ySeq = validate_xtrans(xlsx);
console.log(`YAML file #items:`,ySeq.length)

const yaml_txt = yaml.safeDump(ySeq,{skipInvalid:true});
if (output) {
  fs.writeFileSync(output, yaml_txt)
} else {
  const ofn = xlsx_fn.replace(/\.xlsx$/,'.yaml');
  _assert(ofn != xlsx_fn, ofn, xlsx_fn)
  fs.writeFileSync(ofn, yaml_txt)
}

process.exit(1);

fs.writeFileSync(xlsx_fn.replace('.xlsx','.yaml'), yaml.join('\n'));

//const publishers = Object.keys(_hp)

//console.log(`3. found ${publishers.length} publishers.`)

// ===========================================================================

/*************************************************************

  Conversion from xlsx : an array of rows for several sections
  into a sequential-yaml
  - level 1: section contains multiple articles/catalogues
  - level 2: article/catalogue contains multiple pdf
  - level 3: pdf-file

  Catalogs:
   -


**************************************************************/

function validate_xtrans(xlsx) {
  const ySeq = [];

  const _constructeurs={}, _publishers={};
  const _sections={};
  const _marques={}, _produits={}, _auteurs={}; // for cr_keywords

  function near_miss3(_h, title, it, object_type) {
    const titles = (Array.isArray(title))? title : [title];

    titles.forEach(_title =>{
      const name = xnor3(_title)
      _h[name] = _h[name] || new Set([_title]);
      if (!_h[name].has(_title)) {
        verbose &&
        console.log(`${it.xid} NEAR-MISS [${object_type}] [${_title}] [${Array.from(_h[name]).join(', ')}]`);
      }
      _h[name].add(title);
    })
  }

  _assert(Array.isArray(xlsx), "fatal", "xlsx is not an Array.");

  let err_Count =0;
  for (ix in xlsx) {
    const it = xlsx[ix]; // all refs are in ix not xid.
    const {xid, sec, deleted} = it;
    if (deleted) continue;

    const {h1, h2:produits, mk:marques, indexNames} = it;
    //console.log(`-- xid:${xid} sec:${sec}`)
    if (!xid) {
      verbose &&
      console.log(`ALERT invalid-xid row:`,it)
      err_Count +=1;
      continue;
    }



    /***********************************
      Catalogs.
    ************************************/
    if (sec <=2) {
      const {sec, xid, co} = it;
      let {indexNames} = it; // can be null
      if (!indexNames) {
        verbose &&
        console.log(`${xid} WARNING: Missing indexName - fixed by using h1.`)
        err_Count +=1;
      }
      indexNames = indexNames || [h1];
      __assert(indexNames.length >=1, "", "Missing indexNames");

      const title = (indexNames && indexNames[0]) || h1;
//      const name = `${co}::${title}`;
      const constructeur_name = `${title}@[${co}]`;
      Object.assign(it,{title, constructeur_name, indexNames})

      register_constructeur(ix);
      register_catalog(ix);
      register_produits(ix);
      register_marques(ix);
    }
    else {
      const {h1, auteurs} = it;
      let {indexNames} = it; // can be null
      if (!indexNames) {
        verbose &&
        console.log(`${xid} WARNING: Missing indexName - fixed by using h1.`)
        err_Count +=1;
      }
      indexNames = indexNames || [h1];
      //_assert(auteurs.length <=1, it, `Multiple publishers:${auteurs.length}`);

      __assert(indexNames.length >=1, it, "Missing indexNames");

      // no such thing register_publisher(indexNames[0], xid);
      register_auteurs(ix); // no publisher
      register_article(ix);
      // register_keywords()
    }

  } // loop on each xlsx row.

  function isec2path(isec) {
    return (+isec <=2) ? `c.${isec}` : `a.${isec}`;
  }

  /***************************************************

    push back references to marques, produits, auteurs.

    WHAT FOR ?

  ****************************************************/


  console.log(`3. validate_xtrans: err_Count:${err_Count}/${xlsx.length}`);

  const base_ofn = xlsx_fn.replace(/\.xlsx$/,'');
  _assert(base_ofn != xlsx_fn, base_ofn, xlsx_fn)
  writeJsonFile.sync(base_ofn + '-constructeurs.json',_constructeurs)
  console.log(`4. construteurs.json saved.`)
  writeJsonFile.sync(base_ofn + '-marques.json',_marques)
  console.log(`5. marques.json saved.`)
  writeJsonFile.sync(base_ofn + '-produits.json',_produits)
  console.log(`6. produits.json saved.`)
  writeJsonFile.sync(base_ofn + '-auteurs.json',_auteurs)
  console.log(`7. auteurs.json saved.`)

return ySeq;

// --------------------------------------------------------------------------

function register_produits(ix) {
  const {xid, h2:products} = xlsx[ix]
  products && products.forEach(p =>{
    _produits[p] = _produits[p] || [];
    _produits[p].push(ix);
    if (_produits[p].length == 1) {
      // we might name a name...
      ySeq.push({product:p, xid})
    }
  })
}

// --------------------------------------------------------------------------

function register_auteurs(ix) {
  const {xid, auteurs} = xlsx[ix];
  auteurs && auteurs.forEach(au =>{
    const name = xnor3(au)
    _auteurs[name] = _auteurs[name] ||[];
    _auteurs[name].push(ix);
    if (_auteurs[name].length == 1) {
      // we might name a name...
      ySeq.push({auteur:au, name, xid})
    }
  })
}

// --------------------------------------------------------------------------

function register_marques(ix) {
  const {xid, mk, constructeur_name, parent_ix} = xlsx[ix]
  mk && mk.forEach(label =>{
    if (!label) {
      console.log('NULL LABEL it:',it)
      throw 'fatal@219'
    }
    _assert(label, xlsx[ix], `null label at ix:${ix}`);

    near_miss3(_marques, label, xlsx[ix], 'marque')
return;

    _marques[label] = _marques[label] || {ix_ref:ix, list:[]};
    _marques[label].list.push(ix);
    if (_marques[label].list.length == 1) {
      // we might name a name...
      ySeq.push({marque: label, xid})
    }

  }) // each marque.
}

// --------------------------------------------------------------------------

function register_constructeur(ix) {
  // first ix is where the constructeur is first seen. => definition
  const {constructeur_name:name, title, co,ci,sa,yf, xid} = xlsx[ix]
  _constructeurs[name] = _constructeurs[name] || [];
  _constructeurs[name].push(ix);
  xlsx[ix].parent_ix = _constructeurs[name][0];
  if (_constructeurs[name].length == 1) {
    ySeq.push({constructeur:name, title, ix, co, sa, ci, yf, xid});
  }

}

// --------------------------------------------------------------------------

function register_catalog(ix) {
  const {h1, sec, xid, indexNames, co, ci, sa, yp, h2:products, links, pic, mk} = xlsx[ix];
  const title = (indexNames && indexNames[0]) || h1;
  const name = `${title}@[${co}/${yp}/${xid}]`;
  ySeq.push({
    catalog: title, // the constructeur name, no specific title fo catalogs
    name: 'catalog-'+xid,
    // catalog.name will be built in next step import-yaml
    path: isec2path(sec)+'.'+co.toLowerCase(),
    yp, co, ci, sa,
    indexNames,
    products, marques:mk,
    pic,
    links,
    xid, // pour info.
  })
}

// --------------------------------------------------------------------------

function register_article(ix) {
  const {h1, sec, xid, indexNames, co, ci, sa, auteurs, links, pic} = xlsx[ix];
  const title = (indexNames && indexNames[0]) || h1;
  const name = `${title}@[${xid}]`; // constructeur name
  ySeq.push({
    article: title, // the constructeur name, no specific title fo catalogs
    // article.name will be built in next step import-yaml
    path: isec2path(sec),
    auteurs,
    ci, sa,
    indexNames,
    pic,
    links,
    xid, // pour info.
  })
}

// --------------------------------------------------------------------------
throw "WE SHOULD NOT BE HERE"
}
