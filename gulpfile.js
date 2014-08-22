var gulp   = require('gulp');
var uglify = require('gulp-uglify');
var jshint = require('gulp-jshint');
var rename = require('gulp-rename');

var paths = {
  scripts: './lib/*.js',
  dist: 'dist/'
};

gulp.task('copy', function() {
  gulp.src(paths.scripts)
    .pipe(gulp.dest(paths.dist));
});

gulp.task('minify', function() {
  gulp.src(paths.scripts)
    .pipe(uglify())
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

gulp.task('dist', ['copy', 'minify']);
