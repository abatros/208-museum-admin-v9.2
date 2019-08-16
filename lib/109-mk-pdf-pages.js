const fs = require('fs')
const path = require('path')
var find = require('find-promise');
const pdfjsLib = require('pdfjs-dist');

const api = require('../../207-jpc-catalogs-admin/lib/openacs-api')
const {_assert, __assert} = require('../../207-jpc-catalogs-admin/lib/openacs-api');


module.exports = function (argv) {
//  const {pg_monitor, instance_name, ipath, verbose, pdf_root_folder} = argv;
//  console.dir(`Connect database - switching async mode.`)

  main(argv)
  .then(async ()=>{
  })
  .catch((err)=>{
    console.log('fatal error in main - err:',err);
    api.close_connection()
    console.dir('Closing connection - Exit: FAILED.');
  })

}



async function main(argv) {
  const {pg_monitor, instance_name, ipath, pdf_paths, verbose, pdf_root_folder, force_refresh} = argv;
  verbose &&
  console.log(`Connecting to database - switching async mode.`)
  const {db} = await api.connect({pg_monitor});
  verbose &&
  console.log(`Connected.`)

  await db.query(`
    select * from cms.app_instances where instance_name = $1;
    `, [instance_name], {single:false})
  .then(apps =>{
    if (apps.length == 1) {
      app = apps[0]; // global.
      verbose && console.log(`found app:`,app)
      app.db = db;
    } else {
      console.log(`found ${apps.length} for instance-name:(${instance_name})`,)
      throw 'stop@100';
    }
  })


  /***********************************************
      HERE: app has {package_id, app-folder}
  ************************************************/

  const catalogs = await db.query(`
    select
      revision_id,
      object_type,
      --nls_language,
      path, name,
      item_id, parent_id,
      title, package_id,
      -- context_id, content_type,
      data
    from cms.revisions_latest
    where (package_id = $(package_id)) and (object_type = 'catalog')
    and (path <@ $(ipath))
    order by revision_id
    ;
  `, {package_id:app.package_id, ipath:ipath||''}, {single:false})
  .then(catalogs =>{
    console.log(`> found ${catalogs.length} catalogs in app:`,app.instance_name)
    return catalogs;
  });

  console.log(`check for missing links(pdf)`)

  let missing_link_Count =0, pdf_totalCount=0;

  for (let cat of catalogs) {
    const {revision_id, item_id, path, data, nls_language} = cat;
    if (!data.links || data.links.length <=0) {
      missing_link_Count ++;
    } else {
      pdf_totalCount += data.links.length;
    }
  }

  console.log(`${missing_link_Count}:${catalogs.length} catalogs without pdf - found ${pdf_totalCount} pdf`)

  ;(!pdf_paths) &&
  console.log(`no check on pdf`);

  let txt_count =0;
  let file_not_found_Count =0;

  async function lookup_link(link) {
    const {fn, fsize, mtime} = link;
    __assert(fn, link, "Missing fn");
    __assert(pdf_paths, argv, "Missing pdf_paths");

    const {error, pdf_fn, v} = await locate_pdf_file(fn+'.pdf', pdf_paths);
    if (!pdf_fn) {
      //verbose && 
      console.log(`ALERT - Unable to locate file <${fn}> error:${error} in:`,pdf_paths)
      return {error:'file-not-found'};
    } else {
      verbose &&
      console.log(`found pdf at <${pdf_fn}>`)
    }

    /***************************************************
    DETECT {lang,...}
    split fn
    ****************************************************/

    /*
      DO NOT ADD TXT if fsize and timeStamp are unchanged.
      BUT WHO and when {fsize,timeStamp} updated ?
      -> after pdf-scan pages.
    */
    //console.log(fn)

    const {size:_fsize, mtime:_mtime} = fs.lstatSync(pdf_fn);

//    console.log(`files[0]:`,files[0]);
//    console.log(`fsize: (${fsize})=>(${size})`);
//    console.log(`mtime: (${mtime})=>(${mtime.getTime()})`);
//    console.log(`timeStamp: (${timeStamp})=>(${mtime}) ~~ ${new Date(mtime)}~~${new Date(timeStamp)}`);



    if (
      (!force_refresh) && (+fsize == +_fsize)
//          && (+mtime == _mtime.getTime())
    ) {
      verbose &&
      console.log(`-- pdf-link ${path} is UPTODATE  {fsize:${fsize},timeStamp:${mtime}} <${pdf_fn}>`);
      return {
        fpath:pdf_fn,
        new_version:false
      }
    } else {
      if (verbose >0) {
        console.log(`CHANGED fsize: ${fsize} <> ${_fsize}`);
        console.log(`CHANGED timeStamp: ${mtime} <> ${_mtime.getTime()}`);
      }
      return {
        fpath:pdf_fn,
        mtime:_mtime,
        fsize:_fsize,
        new_version:true
      }
    }
  } // lookup_link => {fpath,mtime,fsize,unchanged} or null if not found.

  // -------------------------------------

  async function remove_existing_txt() {
    await db.query(`
      delete from txt
      where object_id = $1
      `, [item_id], {single:true});
  }

  // -------------------------------------

  async function split_insert_pdf_pages(fn) {
    const doc = await pdfjsLib.getDocument(fn);
    verbose && console.log(`found ${doc.numPages} pages for <${fn}>`);

    //if (ix >=0) break;


    _assert(item_id, s, "Missing section-pdf::item_id@155")

    for (let pageno=1; pageno <=doc.numPages; pageno++) {
      const page = await doc.getPage(pageno);
      const textContent = await page.getTextContent();
      const raw_text = textContent.items
        .map(it => it.str).join(' ')
        .replace(/\s+/g,' ')
        .replace(/\.\.+/g,'.');

      if (!raw_text || raw_text.length <=0) continue;
      verbose && console.log(`---- pageno:${pageno}`)

      /****************************************************************
          Create a TXT record => cr_revision = cr_item.latest_revision
       ****************************************************************/
//continue; // dry-run

      await db.query(`
      insert into txt (object_id, lang, data) values ($1,$2,$3) returning object_id;
      `,[
        item_id,
        to_pg_lang(nls_language),
        {url, pageno, raw_text}
        ],{single:true})
       .then((retv)=>{
         verbose && console.log('insert into txt =>retv:',retv)
         return retv
       }) // then

    } // each pdf-page


    /***********************************************************
        When everything deleted, update {fsize,timeStamp}
        We are updating a revision....!!! bizarre.
        We should never update a revision!
    ***********************************************************/

    //console.log('data1>', data)

    Object.assign(data, {
      fsize: +size,
      timeStamp: +mtime.getTime()
    })

    //console.log('data2>', data)

    await db.query(`
      update cr_revisions
      set data = $1
      where revision_id = $2
      returning revision_id;
      `, [data, revision_id], {single:true})
    .then(retv =>{
      console.log(`section-pdf ${path} UPDATED {fsize,timeStamp} retv:`,retv);
    })

    /************************************************
    ALSO: update cr_item.path if needed.
    *************************************************/
  } // reload_new_txt(fn)



  for (let cat of catalogs) {
    const {revision_id, item_id, path, data, nls_language} = cat;
    __assert(data, cat, "Missing revision.data")
    const links = data && data.links;
    (verbose>1) &&
    console.log(`cat.links:`,links)

    if ((ipath) && (path != ipath)) continue;

    data.links.forEach(async (link) =>{
      const {error, new_version, fpath} = lookup_link(link)
      if (error) {
        console.log(`file-not-found => nothing to do.`)
        file_not_found_Count ++;
      } else if (new_version) {
        await remove_existing_txt();
        await split_insert_pdf_pages(fpath);
      }
    })

    /*********************************************************

    FIRST: remove old TXT for this pdf-file.

    **********************************************************/




    /******************************************************

        NEXT: scan the pdf, and insert TXT/pdf-pages.

    *******************************************************/



  } // each catalog.

  console.log(`pdf files-not-found : ${file_not_found_Count}:${pdf_totalCount}`)
  await api.close_connection(db)
  console.dir('Closing connection - Exit: Ok.')
}

// -------------------------------------------------------------------------

//"developing and deploying a LIFF App is no magic. But using DDP in a LIFF App,

async function locate_pdf_file(fn, pdf_paths) {
  pdf_paths = (Array.isArray(pdf_paths)? pdf_paths : [pdf_paths]);
  const v =[];

  pdf_paths.forEach(path1 =>{
    const fpath = path.join(path1, fn);
    if (fs.existsSync(fpath)) v.push(fpath)
  })

  return (v.length ==1)? {pdf_fn:v[0]}
  : (v.length <1)? {error:'file-not-found'}: {error:'multiple-matches',v};
}

/*****************************************************
async function locate_pdf_file2(url, pdf_paths) {
  pdf_paths = (Array.isArray(pdf_paths)? pdf_paths : [pdf_paths]);
  const regex = new RegExp(url)
  // url MUST contains file extension.

  pdf_paths.forEach(fpath =>{
    const files = await find.file(regex, folder_path);

  })
  if (fs.existsSync(url)) return url;
  if (fs.existsSync(url+'.pdf')) return url+'.pdf';

  url = url+'.pdf';
  const regex = new RegExp(url)
//    const files = await find.file(regex,'/media/dkz/Seagate/2019-museum-assets');

  if (files.length <=0) {
    console.log(`ALERT: no files match for:`,url)
    //console.log(`ALERT:`,extlink)
    return null
  }
  if (files.length >1) {
    console.log('ALERT: multiple matches for:',url)
    console.log(files)
    throw 'ALERT: multiple matches for:'+url
    return null;
  }

return files[0];
}
*************************************/

// ---------------------------------------------------------------------------

function to_pg_lang(nls_language) {
  switch(nls_language) {
    case 'fr': return 'french';
    case 'en': return 'english';
    default:
      throw 'INVALID PG-LANGUAGE'
  }
}
