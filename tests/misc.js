var path = require('path')
var test = require('tape')
var anymatch = require('anymatch')
var rimraf = require('rimraf')
// var memdb = require('memdb')
// var memdown = require('memdown')
// var hyperdrive = require('hyperdrive')
// var encoding = require('dat-encoding')
// var fs = require('fs')
// var os = require('os')
// var mkdirp = require('mkdirp')

var Dat = require('..')
var shareFolder = path.join(__dirname, 'fixtures')

test('default ignore', function (t) {
  rimraf.sync(path.join(shareFolder, '.dat')) // for previous failed tests
  Dat(shareFolder, function (err, dat) {
    t.error(err)
    setTimeout(function () {
      var matchers = [/^(?:\/.*)?\.dat(?:\/.*)?$/, /[/\\]\./]

      t.ok(anymatch(matchers, '.dat'), '.dat folder ignored')
      t.ok(anymatch(matchers, '.dat/'), '.dat folder with slash ignored')
      t.ok(anymatch(matchers, '.dat/foo.bar'), 'files in .dat folder ignored')
      t.ok(anymatch(matchers, 'dir/.git'), 'hidden folders with dir ignored')
      t.ok(anymatch(matchers, 'dir/.git/test.txt'), 'files inside hidden dir with dir ignored')
      t.notOk(anymatch(matchers, 'folder/asdf.data/file.txt'), 'weird data folder is ok')
      t.notOk(
        ['file.dat', '.dat.jpg', '.dat-thing'].filter(anymatch(matchers)).length !== 0,
        'does not ignore files/folders with .dat in it')
      dat.close(function () {
        t.end()
      })
    }, 1000)
  })
})

test('custom ignore extends default (string)', function (t) {
  Dat(shareFolder, { ignore: '**/*.js' }, function (err, dat) {
    t.error(err)
    setTimeout(function () {
      var matchers = [/^(?:\/.*)?\.dat(?:\/.*)?$/, /[/\\]\./, '**/*.js']

      t.ok(anymatch(matchers, '.dat'), '.dat folder ignored')
      t.ok(anymatch(matchers, 'foo/bar.js'), 'custom ignore works')
      t.notOk(anymatch(matchers, 'foo/bar.txt'), 'txt file gets to come along =)')
      dat.close(function () {
        t.end()
      })
    }, 1000)
  })
})
