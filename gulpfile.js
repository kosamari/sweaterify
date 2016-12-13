var gulp = require('gulp')
var uglify = require('gulp-uglify')
var rename = require('gulp-rename')
var webserver = require('gulp-webserver')

gulp.task('minify', function () {
  gulp.src('./assets/js/src/*.js')
    .pipe(uglify())
    .pipe(rename(function (path) {
      path.basename += '.min'
      path.extname = '.js'
    }))
    .pipe(gulp.dest('assets/js/'))
})

gulp.task('watch', function () {
  gulp.watch('./assets/js/src/*.js', ['minify'])
})

gulp.task('webserver', function () {
  gulp.src('./')
    .pipe(webserver({
      livereload: true,
      port: 3100
    }))
})

gulp.task('default', ['minify', 'watch', 'webserver'])
