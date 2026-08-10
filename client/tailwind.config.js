/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta ServicePro: verde-petroleo confiavel + ambar caloroso
        ink: "#0F1B1A", // texto principal, quase preto esverdeado
        teal: {
          50: "#EAF3F2",
          100: "#CFE3E1",
          500: "#0E7C72", // cor primaria da marca
          600: "#0B645C",
          700: "#084A44",
        },
        amber: {
          400: "#F2B441", // acento caloroso (CTA secundario, destaques)
          500: "#E8A21C",
        },
        sand: "#F7F5F0", // fundo claro
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
  plugins: [],
};
