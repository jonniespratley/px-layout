module.exports = {
  verbose: true,
  plugins: {
    local: {
      browsers: [
        'chrome'
      ]
    },
    sauce: {
      disabled: true
    }
  },
  suites: [
    'test/px-action-sheet-test-fixture.html'
  ]
};
