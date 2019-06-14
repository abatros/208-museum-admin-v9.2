String.prototype.RemoveAccents = function () {
//  var strAccents = strAccents.split('');
 var strAccents = this.split('');
 var strAccentsOut = new Array();
 var strAccentsLen = strAccents.length;
 var accents = 'ÀÁÂÃÄÅàáâãäåÒÓÔÕÕÖØòóôõöøÈÉÊËèéêëðÇçÐÌÍÎÏìíîïÙÚÛÜùúûüÑñŠšŸÿýŽž';
 var accentsOut = "AAAAAAaaaaaaOOOOOOOooooooEEEEeeeeeCcDIIIIiiiiUUUUuuuuNnSsYyyZz";
 for (var y = 0; y < strAccentsLen; y++) {
   if (accents.indexOf(strAccents[y]) != -1) {
     strAccentsOut[y] = accentsOut.substr(accents.indexOf(strAccents[y]), 1);
   } else
     strAccentsOut[y] = strAccents[y];
 }
 strAccentsOut = strAccentsOut.join('');
 return strAccentsOut;
}

exports._assert =  function(b, o, err_message) {
  if (!b) {
    console.log(`######[${err_message}]_ASSERT=>`,o);
    console.trace(`######[${err_message}]_ASSERT`);
    throw {
      message: err_message // {message} to be compatible with other exceptions.
    }
  }
}

exports.xnor1 = (s)=>{
  // strip accents.
  const h = {};
  const v = s && (''+s).toLowerCase()
  .RemoveAccents()
  .replace(/[\(\)\.\']/g,'-')
//  .replace(/[^a-z]/g,' ')
  return v;
}

exports.xnor2 = (s)=>{
  // strip accents.
  const h = {};
  const v = s && (''+s).toLowerCase()
  .RemoveAccents()
  .replace(/[\(\)\-\.\']/g,' ')
//  .replace(/[^a-z]/g,' ')
  .replace(/\s+/g,'') // insenstive to spaces, dots, dashes and ().
  return v;
}

exports.xnor3 = (s)=>{
  // strip accents.
  const h = {};
  const v = s && (''+s).toLowerCase()
  .RemoveAccents()
  .replace(/[\(\)\-\.\']/g,' ')
//  .replace(/[^a-z]/g,' ')
  .replace(/\s+/g,'') // insenstive to spaces, dots, dashes and ().
  .split('')
  .forEach(cc=>{
    h[cc] = h[cc] || 0;
    h[cc] ++;
  })

  const s2 = Object.keys(h).map(cc=>{
    return (h[cc]>1)?`${cc}${h[cc]}`:cc;
  })

  return s2.join('');
}
