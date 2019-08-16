#! /usr/bin/env node
const Rsync = require('rsync');

/*
rsync -vv /media/dkz/Seagate/2019-museum-assets/pdf-www/* dkz@ultimheat.com:/www/museum-assets/pdf-www
*/

console.log(`
  ******************************************************
        xp117-rsync.js
  ******************************************************
  `)

  // Build the command
const rsync = new Rsync()
    .shell('ssh')
    .flags('vvv')
    .debug(true)
    //.set('progress')
    .source('/media/dkz/Seagate/2019-museum-assets/pdf-www/*')
    .destination('dkz@ultimheat.com:/www/museum-assets/pdf-www')
    .output(
      function(data) {
        console.log(`progress:`,data)
      },
      function(data) {
        console.log(`error:`,data)
      }
    );


  // Execute the command
rsync.execute(function(error, code, cmd) {
  if (error) {
    throw error;
  }
  console.log(`code:${code} cmd:${cmd}`)
},
function(data) {
  console.log(`progress:`,data)
},
function(data) {
  console.log(`error:`,data)
}
);

console.log('entering async mode.')
