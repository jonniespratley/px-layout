'use strict';
const gulp = require('gulp');
const pkg = require('./package.json');
const $ = require('gulp-load-plugins')();
const gulpSequence = require('gulp-sequence');
const sassdoc = require('sassdoc');
const importOnce = require('node-sass-import-once');
const filelog = require('gulp-filelog');
const rename = require('gulp-rename');
const copy = require('gulp-copy');
const size = require('gulp-size');
const crisper = require('gulp-crisper');
const vulcanize = require('gulp-vulcanize');
const sassdocOptions = {
  dest: 'docs',
  verbose: true,
  display: {
    access: ['public', 'private'],
    alias: true,
    watermark: true,
  },
  groups: {
    'undefined': 'Ungrouped'
  }
};

const sassOptions = {
  importer: importOnce,
  importOnce: {
    index: true,
    bower: true
  }
};


var config = {
  src: '.',
  dest: '.',
  baseElement: 'px-mobile-design.html',
  excludes: [
  '/web-animations-next.min.js',
  'highstock-release/adapters/standalone-framework.js',
  'highstock-release/highstock.src.js',
  'highstock-release/adapters/standalone-framework.js',
  'highstock-release/modules/exporting.src.js',
  'annotations/js/annotations.js',
  '/moment/moment.js',
  'moment/min/moment.min.js',
  '/d3/d3.js',
  '/iron-/',
  //'/Users/predixgo/2016GithubEnterprise/predix-dev-repos/iron-resizable-behavior/iron-resizable-behavior.html'
  //'iron-resizable-behavior',
  //'iron-resizable-behavior/iron-resizable-behavior.html'
  /*'polymer-font-awesome/polymer-font-awesome.html',
		'iron-a11y-keys-behavior/iron-a11y-keys-behavior.html',
		'iron-resizable-behavior/iron-resizable-behavior.html'*/
 ]
};

config.vulcanize = {
  abspath: '',
  excludes: config.excludes,
  stripComments: true,
  inlineScripts: true,
  inlineCss: true
};


gulp.task('sassdoc', function () {
  return gulp.src('sass/**/*.scss')
    .pipe(sassdoc(sassdocOptions));
});

gulp.task('clean', function () {
  return gulp.src(['.tmp', 'css'], {
    read: false
  }).pipe($.clean());
});

gulp.task('cssmin', function () {
  return gulp.src('./css/*.css')
    .pipe(filelog())
    .pipe($.cssmin())
    .pipe($.size())
    .pipe($.rename({
      suffix: '.min'
    }))
    .pipe(gulp.dest('./css'));
});
gulp.task('sass', function () {
  return gulp.src('./sass/*.scss')
    .pipe(filelog())
    .pipe($.sass(sassOptions).on('error', $.sass.logError))
    .pipe($.size())
    .pipe(gulp.dest('./css'));
});

gulp.task('autoprefixer', function () {
  return gulp.src('css/*.css')
    .pipe($.autoprefixer({
      browsers: ['last 2 versions'],
      cascade: false
    }))
    .pipe($.size())

  .pipe(gulp.dest('css'));
});

gulp.task('css', function () {
  return gulp.src('css/**/*.css')
    .pipe(filelog())
    .pipe($.sourcemaps.init())
    .pipe($.cssmin())
    .pipe($.size())
    .pipe($.concat(pkg.name + '.css'))
    .pipe($.sourcemaps.write('.'))
    .pipe($.rename({
      suffix: '.min'
    }))
    .pipe(gulp.dest('css'));
});

gulp.task('sass:watch', function () {
  gulp.watch('./sass/**/*.scss', ['sass']);
});

gulp.task('autoprefixer:watch', function () {
  gulp.watch('./css/**/*.css', ['autoprefixer']);
});



var cssfmt = require('gulp-cssfmt');
//Copy files into bower_components before compile
gulp.task('copy', function () {
  return gulp.src(['*.html', 'css/*.css'])
    .pipe(filelog())
    .pipe(copy(`bower_components/_${pkg.name}`));
});

gulp.task('cssfmt', function () {
  return gulp.src(['css/*.css'])
    .pipe(filelog())
    .pipe(cssfmt())
    .pipe(gulp.dest('css'));
});


gulp.task('crisper', ['copy'], function () {
  return gulp.src(`bower_components/_${pkg.name}/${config.baseElement}`)
    .pipe(vulcanize(config.vulcanize))
    .pipe(rename(pkg.name + '.min.html'))
    .pipe(filelog())
    .pipe(crisper({
      scriptInHead: false,
      onlySplit: false
    }))
    .pipe(size())
    .pipe(gulp.dest(config.dest));
});


gulp.task('vulcanize', ['copy'], function () {
  return gulp.src(`bower_components/_${pkg.name}/${config.baseElement}`)
    .pipe(vulcanize(config.vulcanize))
    .pipe(rename(pkg.name + '.min.html'))
    .pipe(gulp.dest(config.dest));
});


gulp.task('watch', ['sass:watch', 'autoprefixer:watch']);
gulp.task('default', gulpSequence('clean',
  'sass',
  'autoprefixer',
  'cssfmt',
  'css',
  'vulcanize',
  'sassdoc'));
