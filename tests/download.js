var fs = require('fs')
var path = require('path')
var os = require('os')
var test = require('tape')
var rimraf = require('rimraf')
var mkdirp = require('mkdirp')

var Dat = require('..')

// os x adds this if you view the fixtures in finder and breaks the file count assertions
try { fs.unlinkSync(path.join(__dirname, 'fixtures', '.DS_Store')) } catch (e) { /* ignore error */ }

var fixtures = path.join(__dirname, 'fixtures')
var fixtureStats = {
  filesTotal: 2, // table.csv, empty.txt
  bytesTotal: 1441
}

// var downloadDat
var downloadDir
var shareDat
var shareKey

test('prep', function (t) {
  rimraf.sync(path.join(fixtures, '.dat')) // for previous failed tests
  // need live for live download tests!
  Dat(fixtures, { live: true }, function (err, dat) {
    t.error(err, 'share error okay')
    shareKey = dat.key
    shareDat = dat
    testFolder(function () {
      t.end()
    })
  })
})

test('Download with default opts', function (t) {
  Dat(downloadDir, {key: shareKey}, function (err, dat) {
    t.error(err, 'no download init error')
    t.ok(dat, 'callsback with dat object')
    t.ok(dat.key, 'has key')
    t.ok(dat.archive, 'has archive')
    t.ok(dat.db, 'has db')
    t.ok(dat.owner === false, 'archive not owned')

    // downloadDat = dat

    dat.once('update', function () {
      t.pass('dat emits update')
    })

    setTimeout(function () {
      var st = dat.stats.get()
      t.same(st.filesTotal, fixtureStats.filesTotal, 'files total match')
      t.same(st.bytesTotal, fixtureStats.bytesTotal, 'bytes total match')
      t.skip(st.blocksProgress, st.blocksTotal, 'TODO: blocks total matches progress')
      t.skip(st.filesProgress, st.filesTotal, 'TODO: file total matches progress')
      fs.readdir(downloadDir, function (_, files) {
        var hasCsvFile = files.indexOf('table.csv') > -1
        var hasDatFolder = files.indexOf('.dat') > -1
        t.ok(hasDatFolder, '.dat folder created')
        t.ok(hasCsvFile, 'csv file downloaded')

        if (files.indexOf('folder') > -1) {
          var subFiles = fs.readdirSync(path.join(downloadDir, 'folder'))
          var hasEmtpy = subFiles.indexOf('empty.txt') > -1
          t.skip(hasEmtpy, 'empty.txt file downloaded')
          // TODO: known hyperdrive issue https://github.com/mafintosh/hyperdrive/issues/83
        }
        dat.close(function (err) {
          t.error(err, 'dat closed')
          t.end()
        })
      })
    }, 1500)
  })
})

test('cleanup', function (t) {
  shareDat.close(function (err) {
    t.error(err, 'dat closed')
    t.end()
  })
})

function testFolder (cb) {
  // Delete old folder and make new one
  if (downloadDir && downloadDir.length) rimraf.sync(downloadDir)
  downloadDir = path.join(os.tmpdir(), 'dat-download-tests-' + new Date().getTime())
  mkdirp(downloadDir, cb)
}