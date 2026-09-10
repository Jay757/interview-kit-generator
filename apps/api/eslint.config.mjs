export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    rules: {
      "no-unused-vars": "off",
      "no-console": "off",
    },
  },
];
