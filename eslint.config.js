import js from "@eslint/js"
import tseslint from "typescript-eslint"
import jsxA11y from "eslint-plugin-jsx-a11y"

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "supabase/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        __dirname: "readonly",
        process: "readonly",
        location: "readonly",
        URL: "readonly",
        fetch: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
      },
    },
  },
  {
    files: ["src/**/*.tsx"],
    ...jsxA11y.flatConfigs.recommended,
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      "jsx-a11y/anchor-is-valid": [
        "error",
        {
          components: ["Link", "NavLink", "LinkButton"],
          specialLink: ["to"],
          aspects: ["noHref", "invalidHref", "preferButton"],
        },
      ],
      "jsx-a11y/no-noninteractive-tabindex": [
        "error",
        { roles: ["tabpanel", "region"] },
      ],
    },
    settings: {
      "jsx-a11y": {
        components: { Input: "input", Textarea: "textarea", Select: "select" },
      },
    },
  },
)
