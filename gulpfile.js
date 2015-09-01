var gulp   = require('gulp');
var rimraf = require('gulp-rimraf');
var uglify = require('gulp-uglify');
var jshint = require('gulp-jshint');
var rename = require('gulp-rename');
var header = require('gulp-header');

var pkg    = require('./package.json');
var banner = [
  '/**',
  ' * <%= pkg.name %> - <%= pkg.description %>',
  ' *',
  ' * @version   <%= pkg.version %>',
  ' * @link      <%= pkg.homepage %>',
  ' * @author    <%= pkg.author %>',
  ' * @copyright Zendesk',
  ' * @license   <%= pkg.license %>',
  ' */\n\n'
].join('\n');

var paths = {
  scripts: ['./lib/client.js', './lib/hub.js'],
  dist: './dist/'
};

gulp.task('clean', function() {
  gulp.src(paths.dist + '*', {read: false})
    .pipe(rimraf());
});

gulp.task('copy', function() {
  gulp.src(paths.scripts)
    .pipe(header(banner, {pkg: pkg}))
    .pipe(gulp.dest(paths.dist));
});

gulp.task('minify', function() {
  gulp.src(paths.scripts)
    .pipe(uglify())
    .pipe(header(banner, {pkg: pkg}))
    .pipe(rename(function(path) {
      path.basename += '.min';
    }))
    .pipe(gulp.dest(paths.dist));
});

gulp.task('jshint', function() {
  gulp.src(paths.scripts)
    .pipe(jshint())
    .pipe(jshint.reporter());
});

gulp.task('dist', ['clean', 'copy', 'minify']);
