#! /usr/bin/env node


console.log(`
  ******************************************************
  xp-109-mk-pdf-pages.js
  using pdfjsLib, extract pages and commit each of them.
  ATTENTION: nls_language => conversion txt.lang mydatabase=# \dF
  ******************************************************
  `)

const fs = require('fs-extra');
const path = require('path');
const assert = require('assert');
//var find = require('find');
var find = require('find-promise');
const pdfjsLib = require('pdfjs-dist');
const yaml = require('js-yaml');

//const api = require('./lib/openacs-api')
//const {_assert, xnor_name} = require('./lib/openacs-api');

const api = require('../207-jpc-catalogs-admin/lib/openacs-api')
const {_assert, __assert} = require('../207-jpc-catalogs-admin/lib/openacs-api');
const {xnor1, xnor2, xnor3} = require('./lib/utils')



const argv = require('yargs')
  .alias('v','verbose').count('verbose')
  .alias('p','ipath')
  .alias('f','force_refresh')
  .boolean('pg-monitor')
  .boolean('commit')
  .options({
    force_refresh: {
      default:false,
      type:'boolean'
    }
  })
  .options({
    'pg-monitor': {default:false},
    'limit': {default:99999}, // stop when error, if --no-stop, show error.
    'zero-auteurs': {default:false}, //
  }).argv;

const {ipath, force_refresh, verbose} = argv;
const pg_monitor = (verbose>1);
const instance_name = argv._[0];
//const pdf_root_folder = '/home/dkz/2019/207-jpc-catalogs-admin/pdf-20190517';
const pdf_root_folder = '/home/dkz/tmp/new-pdf-and-jpg-20190425';

if (!instance_name) {
  console.log(`
    *********************************
    FATAL: You must specify
    an app-instance name ex: "u2018-fr"
    *********************************
    `);
  process.exit(-1)
}

let {pdf_paths} = yaml.safeLoad(fs.readFileSync(instance_name+'.yaml-config', 'utf8'));

if (!pdf_paths) {
  console.log(`
    *********************************
    NO pdf_paths specified.
    exit.
    *********************************
    `);
  process.exit(-1)
}



const results = require('./lib/109-mk-pdf-pages.js')({
  pg_monitor,
  instance_name,
  ipath, // ltree
  pdf_paths,
  verbose,
  pdf_root_folder
});


console.log(`Entering mode async.`)
