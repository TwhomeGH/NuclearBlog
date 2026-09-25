import postcssImport from "postcss-import";
import tailwindcss from "tailwindcss";
import postcssNesting from "tailwindcss/nesting/index.js";
import autoprefixer from "autoprefixer";

export default {
	plugins: [postcssImport(), postcssNesting(), tailwindcss(), autoprefixer()],
};
