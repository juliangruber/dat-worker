var path = require('path')
var test = require('tape')
var anymatch = require('anymatch')
var rimraf = require('rimraf')
// var memdb = require('memdb')
// var memdown = require('memdown')
// var hyperdrive = require('hyperdrive')
var encoding = require('dat-encoding')
var fs = require('fs')
var os = require('os')
// var mkdirp = require('mkdirp')
var Dat = require('..')
var shareFolder = path.join(__dirname, 'fixtures')

test('default ignore', function (t) {
  rimraf.sync(path.join(shareFolder, '.dat'))
  // for previous failed tests
  Dat(shareFolder, function (err, dat) {
    t.error(err)
    setTimeout(
      function () {
        var matchers = [ /^(?:\/.*)?\.dat(?:\/.*)?$/, /[/\\]\./ ]

        t.ok(anymatch(matchers, '.dat'), '.dat folder ignored')
        t.ok(anymatch(matchers, '.dat/'), '.dat folder with slash ignored')
        t.ok(
          anymatch(matchers, '.dat/foo.bar'),
          'files in .dat folder ignored'
        )
        t.ok(anymatch(matchers, 'dir/.git'), 'hidden folders with dir ignored')
        t.ok(
          anymatch(matchers, 'dir/.git/test.txt'),
          'files inside hidden dir with dir ignored'
        )
        t.notOk(
          anymatch(matchers, 'folder/asdf.data/file.txt'),
          'weird data folder is ok'
        )
        t.notOk(
          [ 'file.dat', '.dat.jpg', '.dat-thing' ].filter(
            anymatch(matchers)
          ).length !==
            0,
          'does not ignore files/folders with .dat in it'
        )
        dat.close(function () {
          t.end()
        })
      },
      1000
    )
  })
})

test('custom ignore extends default (string)', function (t) {
  Dat(shareFolder, { ignore: '**/*.js' }, function (err, dat) {
    t.error(err)
    setTimeout(
      function () {
        var matchers = [ /^(?:\/.*)?\.dat(?:\/.*)?$/, /[/\\]\./, '**/*.js' ]

        t.ok(anymatch(matchers, '.dat'), '.dat folder ignored')
        t.ok(anymatch(matchers, 'foo/bar.js'), 'custom ignore works')
        t.notOk(
          anymatch(matchers, 'foo/bar.txt'),
          'txt file gets to come along =)'
        )
        dat.close(function () {
          t.end()
        })
      },
      1000
    )
  })
})

test('custom ignore extends default (array)', function (t) {
  Dat(shareFolder, { ignore: [ 'super_secret_stuff/*', '**/*.txt' ] }, function (
    err,
    dat
  ) {
    t.error(err)
    setTimeout(
      function () {
        var matchers = [
          /^(?:\/.*)?\.dat(?:\/.*)?$/,
          /[/\\]\./,
          'super_secret_stuff/*',
          '**/*.txt'
        ]

        t.ok(anymatch(matchers, '.dat'), '.dat still feeling left out =(')
        t.ok(anymatch(matchers, 'password.txt'), 'file ignored')
        t.ok(
          anymatch(matchers, 'super_secret_stuff/file.js'),
          'secret stuff stays secret'
        )
        t.notOk(anymatch(matchers, 'foo/bar.js'), 'js file joins the party =)')
        dat.close(function () {
          t.end()
        })
      },
      1000
    )
  })
})

test('ignore hidden option turned off', function (t) {
  Dat(shareFolder, { ignoreHidden: false }, function (err, dat) {
    t.error(err)
    setTimeout(
      function () {
        var matchers = [ /^(?:\/.*)?\.dat(?:\/.*)?$/ ]

        t.ok(anymatch(matchers, '.dat'), '.dat still feeling left out =(')
        t.notOk(anymatch(matchers, '.other-hidden'), 'hidden file NOT ignored')
        t.notOk(
          anymatch(matchers, 'dir/.git'),
          'hidden folders with dir NOT ignored'
        )
        dat.close(function () {
          t.end()
        })
      },
      1000
    )
  })
})

test('string or buffer .key', function (t) {
  rimraf.sync(path.join(process.cwd(), '.dat'))
  // for failed tests
  var buf = new Buffer(32)
  Dat(process.cwd(), { key: buf }, function (err, dat) {
    t.error(err, 'no callback error')
    t.deepEqual(dat.archive.key, buf, 'keys match')

    dat.close(function (err) {
      t.error(err, 'no close error')

      Dat(process.cwd(), { key: encoding.encode(buf) }, function (err, dat) {
        t.error(err, 'no callback error')
        t.deepEqual(dat.archive.key, buf, 'keys match still')
        dat.close(function () {
          rimraf.sync(path.join(process.cwd(), '.dat'))
          t.end()
        })
      })
    })
  })
})

test('leveldb open error', function (t) {
  Dat(process.cwd(), function (err, datA) {
    t.error(err)
    Dat(process.cwd(), function (err, datB) {
      t.ok(err)
      datA.close(function () {
        rimraf(path.join(process.cwd(), '.dat'), function () {
          t.end()
        })
      })
    })
  })
})

test('expose .key', function (t) {
  var folder = path.join(__dirname, 'fixtures')
  var key = new Buffer(32)
  Dat(process.cwd(), { key: key }, function (err, datA) {
    t.error(err)
    t.deepEqual(datA.key, key)

    Dat(folder, function (err, datB) {
      t.error(err)
      t.notDeepEqual(datB.key, key)
      datA.close(function (err) {
        t.error(err)
        datB.close(function (err) {
          t.error(err)
          rimraf.sync(path.join(folder, '.dat'))
          t.end()
        })
      })
    })
  })
})

test('expose .owner', function (t) {
  rimraf.sync(path.join(shareFolder, '.dat'))
  var downFolder = path.join(
    os.tmpdir(),
    'dat-' + Math.random().toString(16).slice(2)
  )
  fs.mkdirSync(downFolder)

  Dat(shareFolder, function (err, shareDat) {
    t.error(err, 'dat shared')
    t.ok(shareDat.owner, 'is owner')

    Dat(downFolder, { key: shareDat.key }, function (err, downDat) {
      t.error(err, 'dat downloaded')
      t.notOk(downDat.owner, 'not owner')

      shareDat.close(function (err) {
        t.error(err, 'share dat closed')
        downDat.close(function (err) {
          t.error(err, 'download dat closed')
          rimraf.sync(downFolder)
          t.end()
        })
      })
    })
  })
})
