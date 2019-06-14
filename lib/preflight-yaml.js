const {xnor1, xnor2, xnor3} = require('./utils')
const {split_pdf_raw_text, pdf_lookup, pdf_findSync} = require('./pdf-split.js');
const {_assert, __assert} = require('../../207-jpc-catalogs-admin/lib/openacs-api');

/************************************************
  FIRST VALIDATION
  we have sequential-yaml with {auteurs, products, keywords, catalogs, constructeurs, articles}
  reassign an object-type for each item.
*************************************************/

function preflight(yaml_data, options) {
  options = options ||{};
  const {verbose, pdf_folders} = options;

  // to detect near-misses
  const _constructeurs ={};
  const _products ={};
  const _marques ={};
  const _auteurs ={};

  let v1_errors =0;
  let pdf_missedCount =0;
  let pdf_totalCount =0;
  let near_missCount =0;

  /*
  specific to jpc-france:
  Inheritance : {pic}
  */

  // Context.
  let pic = null;
  let fpath = null;
  let lang = null;

  /************************************************

    PREFLIGHT
    checking for close-miss
    populate the cache {products, marques, auteurs, keywords}

  *************************************************/

  // key is xnor3(title):

  for (let it of yaml_data) {
    const {xid, title} = it;

    function near_miss3(_h, title) {
      const name = xnor3(title)
      _h[name] = _h[name] || new Set([title]);
      if (!_h[name].has(title)) {
        verbose &&
        console.log(`${xid} NEAR-MISS ${it.object_type} [${title}] [${Array.from(_h[name]).join(', ')}]`)
        near_missCount ++;
      }
      _h[name].add(title);
    }

    function register_marques(it) {
      // In preflight : check near-misses
      const {marques:mk} = it;
      mk && mk.forEach(label =>{
        if (!label) {
          console.log('NULL LABEL it:',it)
          throw 'fatal@219'
        }
        // first check near-miss
        near_miss3(_marques, label)
      }) // each marque.
    }


    if (it.catalog) {
      // catalog.title is not unique, not clean !
      // catalog.name will be the xid. (unique)

      const {catalog:title, path, xid, indexNames, co, ci, sa, yp, pic, products, marques, links} = it;
      // const name = `${title}@[${co}/${yp}/${xid}]`;
      Object.assign(it,{title, object_type:'catalog'})
      register_marques(it);
      //register_products(it);
      //record_fsize_mtime(it); // it.links gets {mtime,fsize}
      pdf_folders && it.links && it.links.forEach(async (link) =>{
        pdf_totalCount ++;
        const fn = link.fn + '.pdf';
        // const retv = pdf_lookupSync(fn, pdf_root_folder)

        const retv = pdf_lookup(fn, pdf_folders)
        if (retv) {
          verbose && console.log(`${xid} found pdf ${fn} =>`,retv);
          const {mtime, fsize, fpath} = retv;
          /****************************** NOT HERE
          pdfjsLib.getDocument(fpath)
          .then(({numPages:np}) =>{
            console.log(`npages ${link.np}=>${np}`)
          })
          *****************************************/
  //        const np = await pdfjsLib.getDocument(fpath).numPages;
          Object.assign(link, {mtime, fsize, fpath})
        } else {
          //verbose &&
          console.log(`${xid} missed pdf <${fn}> not found.`);
  //        throw 'stop@144'
          Object.assign(link, {error:'missing'})
          pdf_missedCount ++;
        }
      })
      continue;
    }

    if (it.constructeur) {
      it.object_type = 'constructeur';
      let {constructeur:title, name} = it;
      _assert (!name, it, "Corrupted")
      _assert (title, it, "Corrupted")
      name = xnor3(title)
      Object.assign(it,{title, name})
      near_miss3(_constructeurs, title)
      continue;
    }

    if (it.article) {
      it.object_type = 'article';
      continue;
    }

    if (it.product) {
      let {product:title, name} = it;
      it.object_type = 'product';
      _assert (!name, it, "Corrupted")
      _assert (title, it, "Corrupted")
      name = xnor3(title)
      Object.assign(it,{title, name})
      near_miss3(_products,title)
      continue;
    }

    if (it.keyword) {
      it.object_type = 'keyword';
      continue;
    }

    if (it.marque) {
      it.object_type = 'marque';
      let {marque:title, name} = it;
      _assert (!name, it, "Corrupted")
      _assert (title, it, "Corrupted")
      name = xnor3(title)
      Object.assign(it,{title, name})
      near_miss3(_marques,title)
      continue;
    }

    if (it.auteur) {
      it.object_type = 'auteur';
      let {auteur:title, name} = it;
      //_assert (!name, it, "Corrupted")
      _assert (title, it, "Corrupted")
      name = xnor3(title)
      Object.assign(it,{title, name})
      near_miss3(_auteurs,title)
      continue;
    }
    console.log(`found Invalid Object in yaml-data it:`,it);
    v1_errors +=1;
  }

  return {
    _constructeurs,
    _products,
    _marques,
    _auteurs,

    v1_errors,
    pdf_missedCount,
    pdf_totalCount,
    near_missCount,
  }
}


module.exports ={
  preflight
}
