const assert = require('assert')
const _assert = require('./utils.js')._assert;

const iso_cc = {
  DE:'Allemagne',
  GB:'Angleterre',
  AT:'Autriche',
  BE:'Belgique',
  FR:'France',
  ES:'Espagne',
  IE:'Irlande',
  IT:'Italie',
  LU:'Luxembourg',
  MC:'Principauté de Monaco',
  RU:'Russie',
  CH:'Suisse',
  US:'USA',
  GK:'Grèce',
  CN:'Chine',
  SC:'Ecosse',
  NL:'Hollande',
  SW:'Suède',
  PR:'Prusse',
  DK:'Danemark',
  MO:'Monaco',
  JP:'Japon',
  SA:'Allemagne (Sarre)'
};

//console.log(`\nCountries Index/frequence`)
Object.keys(iso_cc).forEach(cc=>{
  iso_cc[iso_cc[cc]] = cc;
})

/*
      isoc12 for constructeurs.
      get first => legalName
      others as acronyms (aka)
*/

function isoc12__(isoc) {
  assert(Array.isArray(isoc))
  const v = isoc.splice(0,1);
  return {
    legalName:v[0],
    aka: isoc
  };
}


function isoc3 (isoc) {
  /******************************
    decoding column isoc for Articles.
    Syntaxe: Auteur ending with a delimiter (dot.),
        followed by indexNames (alternate titles for this article) - comma separated.
    Multiple auteurs are separated by <comma>
    ATTN: dots in parenthesis are not delimiters.
    returns:
      {auteurs,indexNames}
  *******************************/
  /*
      proteger les points dans les parenteses; split on "|".
  */
  const v = isoc.replace(/\([^\)]*\)/g,($)=>{
    return $.replace(/\./g,'~');
  }).split('|')

  /*
      split first part, if (dot) is found.
      <auteur>,<auteur>(dot)<titres>
  */

  const vv = v[0].split('.').map(it=>(it.trim()));
  let [va, titre1] = vv;

  /*
      Get auteurs, re-establish dots in parenteses.
  */

  const auteurs = va.split(',').map(it=>(it.trim().replace(/~/g,'.')));

  let titres;
  if (titre1) {
    titres = titres || [];
    titres.push(titre1.trim()); // first group (|)
  }

  for (const i in v) {
    if (i >0) {
      titres = titres || [];
      titres.push(v[i].trim())
    }
  }
  // titles can be null.
  return {auteurs, titres} // titres are for entries in index articles.
}


module.exports= (json)=>{
  const alerts = [];

  function alert(s) {alerts.push(s);}

  for (const ix in json) {
    const it = json[ix];
//    console.log(`--${ix}`)
    // S: flags
    it.flags = (''+(it.flags||'*')).trim().toUpperCase();
    it.deleted = (it.flags && (it.flags.indexOf('D')>=0)) || false;
    it.restricted = (it.flags && (it.flags.indexOf('R')>=0)) || false;
    it.transcription = (it.flags && (it.flags.indexOf('T')>=0)) || false;

    if (it.deleted) {
      json[ix] = {deleted:true, xid:0};
      continue;
    }


    // A: xid
    it.xid = +(it.xid);
    _assert((it.xid>=3000)||(it.xid<9999), it, `fatal-127. out-of-range xid:${it.xid}`)

    // B: sec
    it.sec = +((it.sec + '').trim());

    // C: yp
    if (it.yp.length<0) throw `fatal-267::xid:${it.xid}`;
    it.yp = +((it.yp + '').trim());
    if (it.yp<10) throw `fatal-267::xid:${it.xid}`
    if (it.yp>3000) throw `fatal-267::xid:${it.xid}`

    // D: circa 'ca'
    it.circa = (it.circa && it.circa.toLowerCase().trim() == 'ca')?'ca':undefined;

    // E: jpeg-pic
    if (!it.pic) {
      it.pic = `${it.yp}-xid-${it.xid}.missing`
    } else {
      it.pic = it.pic.trim();
    }

    // F: co - country
    it.co = (it.co && it.co.trim()) || 'France'; // default.
    it.co = iso_cc[it.co]
    if (!iso_cc[it.co]) {
//      console.log(iso_co)
      throw `Unknow (${it.co})`
    }

    // G: h1
    it.h1 = it.h1.trim();
    if (!it.h1 || (it.h1.length <=0)) { // The Original NAME - not suitable for sort.
      alert(`-- Missing constructeur/AUTHOR line-${ix+2} xid:${it.xid}`);
      err_Count ++;
      it.h1 = '*dkz::Unknown-soc/author*'
      throw 'fatal-128'
    }

    // H: isoc
    if (+it.sec >=3) {
      // Article - without publisher.
      // specific to mapp9 => fake publisher.
      const {auteurs, titres} = isoc3(it.isoc)
      it.auteurs = auteurs;
      it.indexNames = titres;
      _assert(Array.isArray(it.auteurs));
//      _assert(Array.isArray(it.titres) && (it.titres.length>0), it, 'fatal-177. Missing titres.');
//      _assert(Array.isArray(it.indexNames), it, 'fatal-177. Missing titres.');
      // it.isoc = undefined;  keep it for debug.
    } else { // Catalog from Constructeurs. (publisher)
      /*
          h1: Article Original name is found in h1.
          it will also be `revision.title`
          isoc => aka : are the positions for this constructeur in the Index.
          option: h1 := aka[0] to fix wrong spellings.
      */
      _assert(it.isoc, it, 'Missing isoc.')
      /*
      it.indexNames = [].concat(it.isoc.split('|').map(it=>it.trim()).filter(it=>(it.length>0)))
      _assert(it.indexNames.length>0, it, 'fatal-187. Missing indexNames') // or it will never be seen in index.
      */
      it.indexNames = it.isoc.split('|').map(it=>it.trim()).filter(it=>(it.length>0))
      // here indexName can be null.
      it.isoc = undefined;

    } // catalogs-constructeurs

    // I: h2 - keywords, products
    if (it.h2)
    it.h2 = (''+it.h2).split(',').map(it=>it.trim().toLowerCase()).filter(it =>(it.length>0))
    it.h2 = it.h2 ||[];

    // J: root
    if (it.root)
    it.root = (''+it.root).split(',').map(it=>it.trim());

    // K: yf - year founded
    if (it.yf)
    it.yf = (''+it.yf).split(',').map(it=>it.trim());

    // L: fr
    it.fr = (''+it.fr).trim();

    // M: marques
    if (it.mk) {
      it.mk = (''+it.mk).split(',').map(it=>it.trim()).filter(it =>(it.length>0));
    }
    it.mk = it.mk ||[];

    // N: en - english
    if (it.en) it.en = it.en.trim();
    // O: zh - chinese
    if (it.zh) it.zh = it.zh.trim();

    // P: ci
    if (it.ci) it.ci = it.ci.trim();

    // Q: sa
    if (it.sa) it.sa = it.sa.trim();

    // RT: pdf-npages
    it.links = (it.links && (''+it.links).split('|').filter(it=>(it.length>0))) || []
//    it.links = (''+it.links).split('|').filter(it=>(it.length>0));
    it.npages = (it.npages && (''+it.npages).split('|').filter(it=>(it.length>0))) || []
    //    it.npages = (''+it.npages).split('|').filter(it=>(it.length>0));
    // validation must be done after flags

    it.links = it.links.map((fn,j)=> ({fn:fn.trim(),np:it.npages[j]||0}));


    // U: rev
    if (it.rev) it.rev= (''+it.rev).trim();
    // V: com
    if (it.com) it.com= (''+it.com).trim();
    // W: ori
    if (it.ori) it.ori= (''+it.ori).trim();


    //    if (transcription) assert(links.length==0)
    if (it.links.length==0) {
      if (it.transcription || it.restricted) {
        // ok
      } else {
        alert(`xid:${it.xid} sec:${it.sec} flags:${it.flags} pdf:${it.links.length} npages:[${it.npages.join(',')}] jpeg:<${it.pic}>`)
      }
      //      console.log(it);
      //      assert(it.transcription || it.restricted);
    } else {
      if (it.links.length != it.npages.length) {
        alert(`xid:${it.xid} sec:${it.sec} flags:${it.flags} pdf:${it.links.length} npages:[${it.npages.join(',')}] jpeg:<${it.pic}>`)
  //      throw 'fatal-166'
      }
    }
    if ((it.links.length==0) && it.transcriptions) {
//      links.push(`${it.xid}.transcription`)
    }


    // invalidate.
    it.flags = undefined
    it.npages = undefined;
//    if (+it.sec !=3) assert(Array.isArray(it.isoc))
    //assert(it.isoc == undefined)
  } // loop
  return {alerts};
}
