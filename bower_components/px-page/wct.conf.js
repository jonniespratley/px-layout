module.exports = {
  verbose: false,
  plugins: {
    local: {
      browsers: ['chrome']
    },
    sauce: {
      disabled: true
    },
    istanbul: {
      'dir': './coverage',
      'reporters': ['text-summary', 'lcov'],
      'include': [
        '/px-*.html'
      ],
      'exclude': []
    }
  },
  suites: [
    'test/px-page-test-fixture.html'
  ]
};
