const gulp = require('gulp');
const { src, dest, series, parallel } = gulp;

var concat = require('gulp-concat'),
    uglify = require('gulp-uglify-es').default,
    newer = require('gulp-newer'),
    sass = require('gulp-sass')(require('sass')),
    autoprefixer = require('gulp-autoprefixer'),
    replace = require('gulp-replace'),
    fileinclude = require('gulp-file-include'),
    fs = require('fs'),
    worker = require('rollup-plugin-web-worker-loader'),
    crypto = require('crypto');

var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var rollup = require('@rollup/stream');
var path = require('path');
var babel = require('@rollup/plugin-babel').babel;
var commonjs = require('@rollup/plugin-commonjs');
var nodeResolve = require('@rollup/plugin-node-resolve');
var regenerator = require('rollup-plugin-regenerator');

var srcFolder = './src/';
var dstFolder = './dest/';
var pubFolder = './public/';
var bulFolder = './build/';
var idxFolder = './index/';
var plgFolder = './plugins/';

function merge(done) {
    let plugins = [babel({
        babelHelpers: 'bundled',
        presets: ['@babel/preset-env']
    }), commonjs, nodeResolve, worker()]

    rollup({
        input: srcFolder + "app.js",
        plugins: plugins,
        output: { format: 'iife', sourcemap: false },
        onwarn: function (message) { return; }
    })
    .pipe(source('app.js'))
    .pipe(buffer())
    .pipe(replace(/return kIsNodeJS/g, "return false"))
    .pipe(dest(dstFolder));

    done();
}

function bubbleFile(name) {
    let plug = [babel({ babelHelpers: 'bundled', presets: ['@babel/preset-env'] }), commonjs, nodeResolve]
    rollup({
        input: plgFolder + name,
        plugins: plug,
        output: { format: 'iife', sourcemap: false },
        onwarn: function (message) { return; }
    })
    .pipe(source(name))
    .pipe(buffer())
    .pipe(fileinclude({ prefix: '@@', basepath: '@file' }))
    .pipe(dest(dstFolder));
}

function getFileHash(path) {
    const fileBuffer = fs.readFileSync(path);
    const hashSum = crypto.createHash('md5');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

function plugins(done) {
    fs.readdirSync(plgFolder).filter(function (file) {
        return fs.statSync(plgFolder + '/' + file).isDirectory();
    }).forEach(folder => {
        bubbleFile(folder + '/' + folder + '.js')
    });
    done();
}

function build_web(done) {
    let date = new Date();
    let full_date = date.getFullYear() + '-' +
        ('0' + (date.getMonth() + 1)).slice(-2) + '-' +
        ('0' + date.getDate()).slice(-2) + ' ' +
        ('0' + date.getHours()).slice(-2) + ':' +
        ('0' + date.getMinutes()).slice(-2);

    src(dstFolder + 'app.js')
        .pipe(replace('{__APP_HASH__}', getFileHash(dstFolder + '/app.js')))
        .pipe(replace('{__APP_BUILD__}', full_date))
        .pipe(dest(bulFolder + 'web/'));

    fs.readdirSync(dstFolder).filter(function (file) {
        return fs.statSync(dstFolder + '/' + file).isDirectory();
    }).forEach(folder => {
        src([dstFolder + folder + '/' + folder + '.js']).pipe(dest(bulFolder + 'web/plugins'));
    });

    done();
}

function lang_task() {
    return src(srcFolder + '/lang/*.js').pipe(dest(pubFolder + '/lang'));
}

function sass_task() {
    return src(srcFolder + '/sass/*.scss')
        .pipe(sass.sync().on('error', sass.logError))
        .pipe(autoprefixer(['last 100 versions', '> 1%', 'ie 8', 'ie 7', 'ios 6', 'android 4'], { cascade: true }))
        .pipe(dest(pubFolder + '/css'))
}

function public_github() {
    return src(dstFolder + '/app.min.js').pipe(dest(bulFolder + 'github/lampa/'));
}

function index_github() {
    return src(idxFolder + '/github/**/*').pipe(dest(bulFolder + 'github/lampa/'));
}

function sync_github() {
    return src([pubFolder + '**/*'])
        .pipe(newer(bulFolder + 'github/lampa/'))
        .pipe(dest(bulFolder + 'github/lampa/'));
}

function write_manifest(done) {
    var manifest = fs.readFileSync(srcFolder + 'core/manifest.js', 'utf8')
    var hash = getFileHash(dstFolder + '/app.js')
    var app_version = manifest.match(/app_version: '(.*?)',/)[1]
    var css_version = manifest.match(/css_version: '(.*?)',/)[1]
    var object = { app_version, css_version, css_digital: parseInt(css_version.replace(/\./g, '')), app_digital: parseInt(app_version.replace(/\./g, '')), time: Date.now(), hash }
    fs.writeFileSync(idxFolder + 'github/assembly.json', JSON.stringify(object, null, 4))
    done()
}

function uglify_task() {
    let date = new Date();
    let full_date = date.getFullYear() + '-' +
        ('0' + (date.getMonth() + 1)).slice(-2) + '-' +
        ('0' + date.getDate()).slice(-2) + ' ' +
        ('0' + date.getHours()).slice(-2) + ':' +
        ('0' + date.getMinutes()).slice(-2);

    return src([dstFolder + 'app.js'])
        .pipe(replace('{__APP_HASH__}', getFileHash(dstFolder + '/app.js')))
        .pipe(replace('{__APP_BUILD__}', full_date))
        .pipe(concat('app.min.js')).pipe(dest(dstFolder));
}

exports.merge = series(merge, plugins, sass_task, lang_task);
exports.pack_github = series(merge, plugins, sass_task, lang_task, sync_github, uglify_task, public_github, write_manifest, index_github);