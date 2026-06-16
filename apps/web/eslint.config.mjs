import coreWebVitals from 'eslint-config-next/core-web-vitals';

export default [
  ...coreWebVitals,
  {
    rules: {
      // New react-hooks v7 rule — too strict for the common "setLoading inside useEffect" pattern
      'react-hooks/set-state-in-effect': 'off',
      // Stylistic rule for unescaped entities — doesn't affect correctness
      'react/no-unescaped-entities': 'off',
    },
  },
];
