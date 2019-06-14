const {_assert, __assert} =  require('./utils.js')
const {commit_revision} = require('../../207-jpc-catalogs-admin/lib/openacs-api/commit-revision-v2.js')

/************************************************************

  for Museum, a Catalog
  - has a title : (h1) default to indexNames[0]
  - pic
  - path: mandatory

*************************************************************/


exports.commit_catalog = async function(o, options) {
  options = options ||{};
  const verbose = options.verbose;
  const {db, package_id, folder_id} = app;
  const {title, pic, path, lang} = o;
  let {name, item_id} = o; // NO parent here. Obsolete.

  _assert(app, app, "Missing global var app.")
  _assert(name, o, "Missing catalog.name")
  _assert(path, o, "Missing catalog.path")
  _assert(lang, o, "Missing catalog.lang") // default for pdf-files

  _assert(pic, o, "Missing cr_revision.data.pic")
  _assert(title, o, "Missing cr_revision.data.title")
  // console.log(`Entering commit_catalog package_id:${package_id} o:`,o)

  // specific to jpc-catalogs => must be unique with parent_id.
  //const path = `U.${lang}.${_path}`;

  Object.assign(o, {
    object_type: 'catalog',
    content_type: 'content_revision',
    title, // revision-title
    object_title: title, // object-title
    name,
    path
  });

  return commit_revision(o, options)
}
