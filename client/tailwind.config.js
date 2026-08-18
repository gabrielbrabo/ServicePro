import plugin from "tailwindcss/plugin";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Cores tematizaveis via variaveis CSS (trocam no modo escuro).
        // Usam a sintaxe rgb(var(--x) / <alpha-value>) para funcionar com
        // utilitarios de opacidade (ex.: text-ink/70, bg-sand/40).
        ink: "rgb(var(--ink) / <alpha-value>)", // texto principal
        sand: "rgb(var(--sand) / <alpha-value>)", // fundo do app
        white: "rgb(var(--surface) / <alpha-value>)", // superficie (cards, navbar)

        // Cores da marca — fixas nos dois temas
        teal: {
          50: "#EAF3F2",
          100: "#CFE3E1",
          500: "#0E7C72",
          600: "#0B645C",
          700: "#084A44",
        },
        amber: {
          400: "#F2B441",
          500: "#E8A21C",
        },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', "system-ui", "sans-serif"],
        body: ['"Inter"', "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "14px",
        "2xl": "20px",
      },
    },
  },
  plugins: [
    plugin(function ({ addBase }) {
      addBase({
        // valores do tema CLARO (identicos ao original)
        ":root": {
          "--ink": "15 27 26", // #0F1B1A
          "--sand": "247 245 240", // #F7F5F0
          "--surface": "255 255 255", // branco (cards)
          colorScheme: "light",
        },
        // valores do tema ESCURO
        ".dark": {
          "--ink": "232 237 236", // texto quase branco
          "--sand": "13 18 17", // fundo bem escuro
          "--surface": "26 33 31", // card um tom acima do fundo
          colorScheme: "dark",
        },
        // fundo e cor de texto base seguem as variaveis (inputs herdam a cor)
        body: {
          backgroundColor: "rgb(var(--sand))",
          color: "rgb(var(--ink))",
        },
        // texto sobre cores solidas (botoes teal/amber/red) continua branco no
        // escuro — senao viraria a cor escura da superficie e sumiria.
        ".dark .text-white": {
          color: "#ffffff !important",
        },
      });
    }),
  ],
};