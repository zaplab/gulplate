
'use strict';

var argv = require('yargs').argv;
var connect = require('gulp-connect');
var del = require('del');
var gulp = require('gulp');
var gulpif = require('gulp-if');
var concat = require('gulp-concat');
var csslint = require('gulp-csslint');
var cssmin = require('gulp-cssmin');
var imagemin = require('gulp-imagemin');
var pngquant = require('imagemin-pngquant');
var jshint = require('gulp-jshint');
var uglify = require('gulp-uglify');
var sass = require('gulp-sass');
var sourcemaps = require('gulp-sourcemaps');
var mochaPhantomJS = require('gulp-mocha-phantomjs');
var browserSync = require('browser-sync');
var browserSyncReload = browserSync.reload;
var runSequence = require('run-sequence');
var header = require('gulp-header');
var eventStream = require('event-stream');

var isDevMode = false,
    isServeTask = false,
    testServerPort = 8080,
    pkg = require('./package.json'),
    banner = ['/*!',
     ' <%= pkg.name %> <%= pkg.version %>',
     ' Copyright ' + new Date().getFullYear() + ' <%= pkg.author.name %> (<%= pkg.author.url %>)',
     ' All rights reserved.',
     ' <%= pkg.description %>',
     '*/'].join('\n');

switch (argv.target) {
    case 'prod':
    /* falls through */
    case 'production':
    /* falls through */
    case 'staging':
        isDevMode = false;
        break;
    case 'dev':
    /* falls through */
    case 'development':
    /* falls through */
    default:
        isDevMode = true;
}

// clear
gulp.task('clean:end', function (cb) {
    del([
        'tmp'
    ], cb);
});

gulp.task('clean', function (cb) {
    del([
        'dist/css',
        'dist/img',
        'dist/js'
    ], cb);
});

gulp.task('jshint', function() {
    return gulp.src('src/js/**/*.js')
        .pipe(jshint({
                lookup: 'tests/.jshintrc'
            }))
        .pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('mocha', function () {
    connect.server({
        root: 'tests',
        port: testServerPort
    });

    gulp.src([
        'src/js/main.js',
        'src/js/module-a.js'
    ])
    .pipe(concat('main.js'))
    .pipe(gulp.dest('tests/dist/js'));

    var stream = mochaPhantomJS();
    stream.write({
        path: 'http://localhost:' + testServerPort + '/index.html',
        reporter: 'spec'
    });
    stream.end();

    stream.on('end', function () {
        connect.serverClose();
    });

    stream.on('error', function (error) {
        connect.serverClose();
    });

    return stream;
});

gulp.task('setup-tests', function (cb) {
    eventStream.concat(
        // mocha
        gulp.src([
            'src/libs/bower/mocha/mocha.css',
            'src/libs/bower/mocha/mocha.js'
        ])
            .pipe(gulp.dest('tests/libs')),
        // chai
        gulp.src([
            'src/libs/bower/chai/chai.js'
        ])
            .pipe(gulp.dest('tests/libs')),
        // ajax-test files
        gulp.src('src/jekyll/ajax-test/**')
            .pipe(gulp.dest('tests/ajax-test'))
    ).on('end', cb);
});

gulp.task('setup', [
    'setup-tests'
]);

gulp.task('test-css', function() {
    return gulp.src('src/css/main.scss')
        .pipe(sass())
        .pipe(csslint('tests/.csslintrc'))
        .pipe(csslint.reporter());
});

gulp.task('test-js', [
    'jshint',
    'mocha'
]);

gulp.task('test', [
    'test-css',
    'test-js'
]);

gulp.task('css', function() {
    return gulp.src('src/css/main.scss')
        .pipe(gulpif(isDevMode, sourcemaps.init()))
        .pipe(sass({
            outputStyle: 'expanded'
        }))
        .pipe(csslint('tests/.csslintrc'))
        .pipe(csslint.reporter())
        .pipe(gulpif(isDevMode, sourcemaps.write('./')))
        .pipe(gulpif(!isDevMode, header(banner, {
            pkg: pkg
        })))
        .pipe(gulpif(!isDevMode, cssmin()))
        .pipe(gulp.dest('dist/css'))
        .pipe(gulpif(isServeTask, browserSync.stream()));
});

gulp.task('js', ['test-js'], function() {
    return gulp.src([
            'src/js/main.js',
            'src/js/module-a.js'
        ])
        .pipe(gulpif(isDevMode, sourcemaps.init()))
        .pipe(concat('main.js'))
        .pipe(gulpif(isDevMode, sourcemaps.write('./')))
        .pipe(gulpif(!isDevMode, header(banner, {
            pkg: pkg
        })))
        .pipe(gulpif(!isDevMode, uglify({
            preserveComments: 'some'
        })))
        .pipe(gulp.dest('dist/js'));
});

gulp.task('fonts', function() {
    return gulp.src('src/fonts/**/*.{ttf,woff,eof,svg}')
        .pipe(gulp.dest('dist/fonts'));
});

gulp.task('images', function() {
    return gulp.src('src/img/**/*.{gif,jpg,png,svg}')
        .pipe(imagemin({
            progressive: true,
            svgoPlugins: [{
                removeViewBox: false
            }],
            use: [
                pngquant()
            ]
        }))
        .pipe(gulp.dest('dist/img'));
});

gulp.task('watch', function () {
    gulp.watch('src/css/**/*.scss', ['css']);
    gulp.watch('src/js/**/*.js', ['js']);
    gulp.watch('src/img/**/*.{gif,jpg,png,svg}', ['images']);
});

gulp.task('serve', [
    'default',
    'watch'
], function () {
    isServeTask = true;

    browserSync({
        server: {
            baseDir: [
                'dist'
            ]
        }
    });

    gulp.watch(['dist/**/*.html'], browserSyncReload);
    gulp.watch(['dist/css/**/*.{css}'], browserSyncReload);
    gulp.watch(['dist/js/**/*.{js}'], browserSyncReload);
    gulp.watch(['dist/img/**/*.{gif,jpg,png,svg}'], browserSyncReload);
});

gulp.task('default', ['clean'], function (cb) {
    runSequence(
        [
            'css',
            'js',
            'images'
        ],
        'clean:end',
        cb
    );
});
