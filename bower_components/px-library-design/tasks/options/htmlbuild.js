module.exports = {
  dist: {
    src: 'src/index.html',
    dest: 'dist',
    options: {
      sections: {
        PXd: 'bower_components/**/src/index.html'
      }
    }
  }
}