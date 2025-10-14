import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      // TypeScript any 타입 경고를 경고로 변경 (에러에서 경고로)
      "@typescript-eslint/no-explicit-any": "warn",
      // 사용하지 않는 변수 경고를 경고로 유지
      "@typescript-eslint/no-unused-vars": "warn",
      // React Hook 의존성 배열 경고를 경고로 유지
      "react-hooks/exhaustive-deps": "warn",
      // 이미지 최적화 경고를 경고로 유지
      "@next/next/no-img-element": "warn",
      // alt 속성 경고를 경고로 유지
      "jsx-a11y/alt-text": "warn",
      // 컴포넌트 display name 경고를 경고로 유지
      "react/display-name": "warn",
      // prefer-const 경고를 경고로 유지
      "prefer-const": "warn",
    },
  },
];

export default eslintConfig;
