module.exports = {
  verbose: true,
  plugins: {
    local: {
      browsers: ['chrome']
    },
    sauce: {
      disabled: true
    },
    "istanbul": {
      "dir": "./coverage",
      "reporters": ["text-summary", "lcov"],
      "include": [
				"/px-*/px-*.html"
			],
      "exclude": []
    }
  },
  suites: [
    'test/px-partials-test-fixture.html'
  ]
};
