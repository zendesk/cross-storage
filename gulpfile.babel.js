import gulp from 'gulp';
import rimraf from 'gulp-rimraf';
import uglify from 'gulp-uglify';
import jshint from 'gulp-jshint';
import rename from 'gulp-rename';
import header from 'gulp-header';

const pkg    = require('./package.json');
const banner = [
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

const paths = {
  scripts: './lib/*.js',
  dist: './dist/'
};

gulp.task('clean', () => {
  gulp.src(paths.dist + '*', {read: false})
    .pipe(rimraf());
});

gulp.task('copy', () => {
  gulp.src(paths.scripts)
    .pipe(header(banner, {pkg: pkg}))
    .pipe(gulp.dest(paths.dist));
});

gulp.task('minify', () => {
  gulp.src(paths.scripts)
    .pipe(uglify())
    .pipe(header(banner, {pkg: pkg}))
    .pipe(rename(function(path) {
      path.basename += '.min';
    }))
    .pipe(gulp.dest(paths.dist));
});

gulp.task('jshint', () => {
  gulp.src(paths.scripts)
    .pipe(jshint())
    .pipe(jshint.reporter());
});

gulp.task('dist', ['clean', 'copy', 'minify']);
