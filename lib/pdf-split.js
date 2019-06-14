// const find = require('find-promise'); // 2016 find.file(regex,path)
const fs = require('fs')
const find = require('find'); // 2019 find.file(regex,path); find.fileSync(regex,path)
const path = require('path')
const pdfjsLib = require('pdfjs-dist');

/**********************************************************

    Locate pdf-files in a folder.
    extract mtimr, fsize
    and number of pages and raw-text for each page.

***********************************************************/

//function extract_raw_text()

function pdf_lookup(fn, folders) {
  folders = (Array.isArray(folders))? folders: [folders];
  for (folder of folders) {
    const fpath = path.join(folder,fn)
    if (fs.existsSync(fpath)) {
      const {size:fsize, mtime} = fs.lstatSync(fpath);
      return {fsize,mtime,fpath}
      break;
    }
  }
}

function pdf_findSync(fn, root_folder) {
  /**************************************************************
      const regex = new RegExp(fn+'$')
      BUG: some file names are not accepted ! Accent ? no idea,
  ***************************************************************/
  //const regex = new RegExp(`${fn}$`,'u')
  const files = find.fileSync(fn, root_folder);
  if (files.length <=0) {
    return null;
    console.log(`ALERT: unable to find <${fn}> files:`,files)
//    throw 'pdf-file-not-found';
    return {size:0, mtime:0}
  }
  if (files.length >1) {
    console.log(`found ${files.length} matches for <fn>:`)
    files.forEach(file =>{
      const {size:fsize, mtime} = fs.lstatSync(file);
      console.log(`-- fsize:${fsize} ${mtime} @<${file.replace(root_folder,'')}>`)
    })
    throw 'multiple-matches';
  }
  const {size:fsize, mtime} = fs.lstatSync(files[0]);
  console.log(`pdf_lookupSync found <${files[0]}>`)
  return {fsize,mtime,fpath:files[0]};
}


async function pdf_get_numPages(fn) {
  const pdf_doc = pdfjsLib.getDocument(fn);
  return doc.numPages;
}

async function split_pdf_raw_text(fn, options) {
  options = options ||{};
  const {verbose} = options;
  const pages =[];

  verbose && console.log(`fetching pdf-document <${fn}>`);
  const pdf_doc = pdfjsLib.getDocument(fn);
  verbose && console.log(`found ${doc.numPages} pages for <${fn}>`);
  for (let pageno=1; pageno <=doc.numPages; pageno++) {
    const page = await doc.getPage(pageno);
    const textContent = await page.getTextContent();
    pages.push(textContent.items)
  }  // each pdf-page
  return pages;
}

// ----------------------------------------------------------------------------

module.exports = {
  split_pdf_raw_text, pdf_lookup, pdf_findSync
}
