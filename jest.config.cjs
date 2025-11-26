const nextJest = require('next/jest')({ dir: './' });

const createJestConfig = nextJest({
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  verbose: true,
});

module.exports = createJestConfig;
